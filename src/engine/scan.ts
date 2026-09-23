import { join } from 'node:path'

import {
  foreignExtensions,
  frameworkSources,
  resolveFramework,
  supportedExtensions,
} from '../data/framework-sources.js'
import { TS_EXTENSIONS } from './facts.js'
import type { Config, FileKind, FileRecord, RoleDescriptor } from './types.js'
import { globToRegExp, relOf, walk } from './util.js'

export const CSS_EXTENSIONS = ['.css', '.scss', '.less']

const SLOT = '__AG_SLOT__'

interface CompiledRole extends RoleDescriptor {
  regex: RegExp
  names: string[]
}

/** `{name}` 占位成单段捕获（用于域目录），其余交给 globToRegExp */
function compile(pattern: string): { regex: RegExp; names: string[] } {
  const names: string[] = []
  const normalized = pattern.replace(/\{([a-zA-Z0-9_]+)\}/g, (_full, name: string) => {
    names.push(name)
    return SLOT
  })
  const { source } = globToRegExp(normalized)
  return { regex: new RegExp(source.split(SLOT).join('([^/]+)')), names }
}

const DEFAULT_SKIP = new Set([
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.git',
  '.turbo',
  '.arch-guard-cache',
])

export interface ScanResult {
  files: string[]
  records: FileRecord[]
  missing: string[]
  ambiguous: { rel: string; roles: string[] }[]
  ignored: string[]
  exempted: { rel: string; reason: string }[]
  /** 契约扫描域之外的 ts/css：不参与角色判定，但**仍要解析**（角色记为 `(outside)`） */
  outside: FileRecord[]
  /** 当前框架包量不了的源码文件（如 react pack 遇到 `.vue`）—— S20 靠它把假绿变成报错 */
  foreign: string[]
}

function kindOf(rel: string): FileKind {
  if (/\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/.test(rel)) return 'ts'
  if (CSS_EXTENSIONS.some((ext) => rel.endsWith(ext))) return 'css'
  if (rel.endsWith('.json')) return 'json'
  return 'other'
}

/**
 * 扫出「文件 + 角色」。
 * 每个文件必须**恰好命中一个角色**（0 个 = 无处安放；≥1 个 = 歧义）—— 结构自检的基础。
 */
export function scanProject(config: Config): ScanResult {
  const { root } = config
  /**
   * 遍历时把**所有**框架的源码扩展名都收进来，再按当前 `metaFramework` 分流：
   * 支持的正常走角色判定；别的框架的（如 react pack 遇到 `.vue`）进 `foreign`。
   *
   * 为什么要收而不是直接无视：扩展名不在白名单里的文件会被 walk 静默丢掉，
   * 于是「本工具量不了这个项目」表现为「0 个文件 → ✔ 通过」—— 假绿比报错危险（S20）。
   */
  const framework = resolveFramework(config.metaFramework)
  const supported = supportedExtensions(framework)
  const foreign_ext = foreignExtensions(framework)
  const allFrameworkExtensions = [...new Set(frameworkSources.flatMap((item) => item.extensions))]
  const walked = walk(root, {
    skip: DEFAULT_SKIP,
    extensions: [...TS_EXTENSIONS, ...CSS_EXTENSIONS, '.json', '.html', ...allFrameworkExtensions],
  }).map((full) => relOf(root, full))

  const foreign: string[] = []
  const files = walked.filter((rel) => {
    const ext = rel.slice(rel.lastIndexOf('.'))
    if (supported.has(ext) || !foreign_ext.has(ext)) return true
    foreign.push(rel)
    return false
  })

  const roles: CompiledRole[] = config.roles.map((descriptor) => ({
    ...descriptor,
    ...compile(descriptor.pattern),
  }))
  const ignore = config.ignore.map(globToRegExp)
  const exempt = config.exempt.map((entry) => ({ ...entry, matcher: globToRegExp(entry.glob) }))
  const include = config.include.map(globToRegExp)

  const records: FileRecord[] = []
  const missing: string[] = []
  const ambiguous: { rel: string; roles: string[] }[] = []
  const ignored: string[] = []
  const exempted: { rel: string; reason: string }[] = []
  const outside: FileRecord[] = []

  for (const rel of files) {
    const exemptEntry = exempt.find((entry) => entry.matcher.test(rel))
    if (exemptEntry) {
      exempted.push({ rel, reason: exemptEntry.reason ?? '' })
      continue
    }
    if (ignore.some((regex) => regex.test(rel))) {
      ignored.push(rel)
      continue
    }
    // 只有代码与样式参与角色判定；json / html 等资源只进文件集（供图解析用）
    const fileKind = kindOf(rel)
    if (fileKind !== 'ts' && fileKind !== 'css') continue
    /**
     * 契约扫描域：域外的 ts/css **不参与角色判定，也不报「不在目录契约内」** ——
     * vite.config.ts / e2e / scripts / 生成代码本来就不该被要求"落位"。
     *
     * 但它们**仍进 `outside` 并被解析**：import 边与「测试是独立可达根」都靠 facts，
     * 少了它们，只被域外测试引用的 src 文件会被误判成孤儿（S15）。
     * 领域外的一大片生成代码怎么省掉解析，见 .scratch/include-scope/spec.md 的非目标。
     */
    if (include.length > 0 && !include.some((matcher) => matcher.test(rel))) {
      outside.push({
        rel,
        abs: join(root, rel),
        role: '(outside)',
        layer: 0,
        domain: null,
        slot: null,
        captures: {},
        group: null,
        groupName: null,
        kind: fileKind,
      })
      continue
    }
    const hits: { descriptor: CompiledRole; captured: Record<string, string> }[] = []
    for (const descriptor of roles) {
      const match = rel.match(descriptor.regex)
      if (!match) continue
      const captured: Record<string, string> = {}
      descriptor.names.forEach((name, index) => {
        captured[name] = match[index + 1] ?? ''
      })
      if (descriptor.exclusive === true) {
        hits.length = 0
        hits.push({ descriptor, captured })
        break
      }
      hits.push({ descriptor, captured })
    }
    if (hits.length === 0) {
      missing.push(rel)
      continue
    }
    if (hits.length > 1) {
      ambiguous.push({ rel, roles: hits.map((hit) => hit.descriptor.id) })
      continue
    }
    const hit = hits[0] as { descriptor: CompiledRole; captured: Record<string, string> }
    // 组身份：角色声明了 `group: '<捕获名>'` 时，把该捕获的值当作"组名"
    const groupName = hit.descriptor.group ?? null
    records.push({
      rel,
      abs: join(root, rel),
      role: hit.descriptor.id,
      layer: hit.descriptor.layer,
      domain: hit.captured.domain ?? null,
      slot: hit.descriptor.slot ?? null,
      captures: { ...hit.captured },
      group: groupName ? (hit.captured[groupName] ?? null) : null,
      groupName: groupName && hit.captured[groupName] ? groupName : null,
      kind: kindOf(rel),
    })
  }

  return { files, records, missing, ambiguous, ignored, exempted, outside, foreign }
}
