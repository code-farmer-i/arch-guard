import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { buildGraph, canonical, extractFacts, resolveSpecifier, scanProject } from '../es/index.js'

const factsOf = (text, rel = 'src/a.ts') => extractFacts({ file: rel, rel, role: 'test', text })

const PACKAGE_ROOT = fileURLToPath(new URL('..', import.meta.url))

/* ---------------- 依赖图 ---------------- */

test('graph：相对 / 别名 / index / 扩展名解析', () => {
  const config = { aliases: { '@': 'src' }, root: '/tmp' }
  const files = new Set(['src/a.ts', 'src/b.ts', 'src/lib/index.ts', 'src/c.tsx'])
  assert.equal(resolveSpecifier('./b.js', 'src/a.ts', config, files), 'src/b.ts')
  assert.equal(resolveSpecifier('@/lib', 'src/a.ts', config, files), 'src/lib/index.ts')
  assert.equal(resolveSpecifier('@/c', 'src/a.ts', config, files), 'src/c.tsx')
  assert.equal(
    resolveSpecifier('react', 'src/a.ts', config, files),
    null,
    '第三方包不解析为项目内路径',
  )
  assert.equal(resolveSpecifier('./missing.js', 'src/a.ts', config, files), null)
})

test('graph：外部包归一化、幽灵 import、环检测、可达性', () => {
  const facts = new Map([
    [
      'src/a.ts',
      factsOf(
        "import x from '@scope/pkg/sub'\nimport y from 'react'\nimport { z } from './b.js'",
        'src/a.ts',
      ),
    ],
    ['src/b.ts', factsOf("import { a } from './a.js'", 'src/b.ts')],
    ['src/orphan.ts', factsOf('export const o = 1', 'src/orphan.ts')],
  ])
  const config = { aliases: {}, root: '/tmp', entries: ['src/a.ts'] }
  const graph = buildGraph({ config, files: [...facts.keys()], facts, cssTexts: new Map() })
  assert.deepEqual([...graph.externals.keys()].sort(), ['@scope/pkg', 'react'])
  assert.equal(graph.cycles.length, 1, 'a ↔ b 成环')
  assert.ok(graph.reachable.has('src/a.ts'))
  assert.ok(graph.orphaned.includes('src/orphan.ts'))
})

test('graph：解析不到的项目内路径进 unresolved（不静默丢）', () => {
  const facts = new Map([['src/a.ts', factsOf("import './nope.js'", 'src/a.ts')]])
  const config = { aliases: {}, root: '/tmp', entries: [] }
  const graph = buildGraph({ config, files: ['src/a.ts'], facts, cssTexts: new Map() })
  assert.deepEqual(graph.unresolved.get('src/a.ts'), ['./nope.js'])
})

/* ---------------- 扫描与角色 ---------------- */

test('scan：合规示例每个文件恰好一个角色，且有歧义/缺失时才报', () => {
  const config = canonical()
  const scan = scanProject({
    ...config,
    roles: config.roles ?? [],
    root: `${PACKAGE_ROOT}examples/minimal`,
    ignore: config.ignore ?? [],
    exempt: [],
    srcRoot: 'src',
    naming: { hookPrefix: 'use', viewSuffix: 'Page', pageComponentSuffix: 'Page' },
    thresholds: {
      fileLines: 400,
      viewLines: 320,
      functionLines: 150,
      exportsPerFile: 6,
      componentsPerFile: 3,
    },
    layers: {},
    adapters: {},
    enable: 'all',
    params: {},
    entries: [],
    aliases: {},
    baselineFile: 'arch.baseline.json',
  })
  assert.deepEqual(scan.missing, [])
  assert.deepEqual(scan.ambiguous, [])
  assert.ok(scan.records.length >= 4)
})
