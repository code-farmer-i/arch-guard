import { posix } from 'node:path'

import { TS_EXTENSIONS } from './facts.js'
import { CSS_EXTENSIONS } from './scan.js'
import type { Config, Facts } from './types.js'
import { globToRegExp } from './util.js'

export interface Graph {
  edges: Map<string, Set<string>>
  importers: Map<string, Set<string>>
  externals: Map<string, Set<string>>
  unresolved: Map<string, string[]>
  reachable: Set<string>
  orphaned: string[]
  cycles: string[][]
}

const RESOLVE_EXTENSIONS = [...TS_EXTENSIONS, ...CSS_EXTENSIONS, '.json']

function packageNameOf(spec: string): string {
  const parts = spec.split('/')
  return spec.startsWith('@') ? parts.slice(0, 2).join('/') : (parts[0] ?? spec)
}

function candidatesFor(target: string): string[] {
  if (RESOLVE_EXTENSIONS.some((ext) => target.endsWith(ext))) return [target]
  const out: string[] = []
  for (const ext of RESOLVE_EXTENSIONS) out.push(`${target}${ext}`)
  for (const ext of RESOLVE_EXTENSIONS) out.push(posix.join(target, `index${ext}`))
  out.push(target)
  return out
}

/** 别名与相对路径解析；解析不到的项目内路径返回 null（第三方包单独记录） */
export function resolveSpecifier(
  spec: string,
  fromRel: string,
  config: Config,
  fileSet: Set<string>,
): string | null {
  const clean = spec.split('?')[0]?.split('#')[0] ?? spec
  let target: string | null = null

  if (clean.startsWith('.')) {
    target = posix.normalize(posix.join(posix.dirname(fromRel), clean))
  } else {
    const aliases = Object.entries(config.aliases).sort((a, b) => b[0].length - a[0].length)
    for (const [alias, replacement] of aliases) {
      if (clean === alias || clean.startsWith(`${alias}/`)) {
        target = posix.normalize(posix.join(replacement, clean.slice(alias.length)))
        break
      }
    }
  }
  if (target === null) return null

  for (const candidate of candidatesFor(target)) {
    if (fileSet.has(candidate)) return candidate
  }
  return null
}

export interface BuildGraphInput {
  config: Config
  files: string[]
  facts: Map<string, Facts>
  /** CSS 文件原文（用于 @import / composes 的引用图） */
  cssTexts: Map<string, string>
  entries?: string[]
}

const CSS_IMPORT_RE = /@import\s+(?:url\()?['"]([^'"]+)['"]/g
const CSS_COMPOSES_RE = /composes\s*:[^;]*?from\s+['"]([^'"]+)['"]/g

export function buildGraph(input: BuildGraphInput): Graph {
  const { config, files, facts, cssTexts } = input
  const fileSet = new Set(files)
  const edges = new Map<string, Set<string>>()
  const importers = new Map<string, Set<string>>()
  const externals = new Map<string, Set<string>>()
  const unresolved = new Map<string, string[]>()

  const link = (from: string, to: string): void => {
    if (!edges.has(from)) edges.set(from, new Set())
    edges.get(from)?.add(to)
    if (!importers.has(to)) importers.set(to, new Set())
    importers.get(to)?.add(from)
  }

  for (const rel of files) {
    const fact = facts.get(rel)
    if (fact) {
      for (const imported of fact.imports) {
        const resolved = resolveSpecifier(imported.spec, rel, config, fileSet)
        if (resolved) {
          link(rel, resolved)
          continue
        }
        if (imported.spec.startsWith('.') || imported.spec.startsWith('@/')) {
          const list = unresolved.get(rel) ?? []
          list.push(imported.spec)
          unresolved.set(rel, list)
          continue
        }
        const pkg = packageNameOf(imported.spec)
        if (!externals.has(pkg)) externals.set(pkg, new Set())
        externals.get(pkg)?.add(rel)
      }
    }
    const css = cssTexts.get(rel)
    if (css) {
      for (const regex of [CSS_IMPORT_RE, CSS_COMPOSES_RE]) {
        regex.lastIndex = 0
        let match = regex.exec(css)
        while (match) {
          const spec = match[1]
          if (spec && !spec.startsWith('http')) {
            const resolved = resolveSpecifier(spec, rel, config, fileSet)
            if (resolved) link(rel, resolved)
          }
          match = regex.exec(css)
        }
      }
    }
  }

  const reachable = computeReachable(input.entries ?? config.entries, edges, importers, files)
  const orphaned = files.filter(
    (rel) => !reachable.has(rel) && !rel.endsWith('.html') && !rel.endsWith('.json'),
  )
  const cycles = findCycles(edges)

  return { edges, importers, externals, unresolved, reachable, orphaned, cycles }
}

function computeReachable(
  entries: string[],
  edges: Map<string, Set<string>>,
  importers: Map<string, Set<string>>,
  files: string[],
): Set<string> {
  const roots = new Set<string>()
  for (const entry of entries) {
    const matcher = globToRegExp(entry)
    for (const rel of files) if (matcher.test(rel)) roots.add(rel)
  }
  // 测试文件是独立根（不进产品依赖图，但也不算孤儿）
  for (const rel of files) if (/\.(test|spec)\.[a-z]+$/.test(rel)) roots.add(rel)

  const seen = new Set<string>()
  const queue = [...roots]
  while (queue.length > 0) {
    const rel = queue.pop() as string
    if (seen.has(rel)) continue
    seen.add(rel)
    for (const next of edges.get(rel) ?? []) if (!seen.has(next)) queue.push(next)
    // 被引用但自身无出边的文件也要标记（父级已入图）
    for (const parent of importers.get(rel) ?? []) {
      if (!seen.has(parent) && roots.has(parent)) queue.push(parent)
    }
  }
  return seen
}

function findCycles(edges: Map<string, Set<string>>): string[][] {
  const WHITE = 0
  const GRAY = 1
  const BLACK = 2
  const state = new Map<string, number>()
  const stack: string[] = []
  const cycles: string[][] = []
  const seen = new Set<string>()

  const visit = (node: string): void => {
    state.set(node, GRAY)
    stack.push(node)
    for (const next of edges.get(node) ?? []) {
      const color = state.get(next) ?? WHITE
      if (color === GRAY) {
        const index = stack.indexOf(next)
        const cycle = stack.slice(index)
        const key = [...cycle].sort().join('>')
        if (!seen.has(key) && cycles.length < 20) {
          seen.add(key)
          cycles.push(cycle)
        }
      } else if (color === WHITE) {
        visit(next)
      }
    }
    stack.pop()
    state.set(node, BLACK)
  }

  for (const node of edges.keys()) if ((state.get(node) ?? WHITE) === WHITE) visit(node)
  return cycles
}
