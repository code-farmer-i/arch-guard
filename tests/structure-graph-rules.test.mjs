import assert from 'node:assert/strict'
import { test } from 'node:test'

import { coreRules } from '../es/index.js'

/** 只填 S08 会读的字段（`unresolved` 等仍保留，镜像真实图形状） */
function context({ records, cycles = [], unresolved = {}, imports = {}, files }) {
  const facts = new Map(
    Object.entries(imports).map(([rel, list]) => [
      rel,
      {
        imports: list.map(([spec, line]) => ({ spec, line, typeOnly: false, dynamic: false })),
      },
    ]),
  )
  return {
    config: {
      root: '/tmp/graph-rules',
      srcRoot: 'src',
      params: {},
      adapters: {},
      naming: { hookPrefix: 'use', viewSuffix: 'Page' },
      thresholds: {
        fileLines: 500,
        viewLines: 500,
        functionLines: 150,
        exportsPerFile: 6,
        componentsPerFile: 3,
      },
      layout: { app: '', modules: '', shared: '' },
      roles: [],
      structure: {
        order: false,
        isolate: [],
        publicApi: [],
        publicApiUnits: [],
        segmentedGroups: [],
        reservedNames: [],
        groupCountLimits: [],
        directoryItemLimits: [],
        groupInDegree: [],
        nameCollisions: [],
        repetitiveNaming: [],
        pluralConsistency: [],
        importLocality: [],
      },
      entries: [],
      ignore: [],
      aliases: {},
    },
    records,
    facts,
    graph: {
      edges: new Map(),
      importers: new Map(),
      externals: new Map(),
      unresolved: new Map(Object.entries(unresolved)),
      reachable: new Set(),
      orphaned: [],
      cycles,
    },
    scan: {
      records: [],
      files: [],
      missing: [],
      ambiguous: [],
      exempted: [],
      outside: [],
      foreign: [],
    },
    deps: { hasManifest: false, runtime: [], dev: [], peer: [], declared: new Set() },
    policy: { allow: [], deny: [], capabilities: {} },
    files: files ?? records.map((record) => record.rel),
    sourceOf: () => undefined,
  }
}

const record = (rel, layer = 1) => ({
  rel,
  abs: `/tmp/graph-rules/${rel}`,
  role: 'x',
  layer,
  domain: null,
  slot: null,
  captures: {},
  group: null,
  groupName: null,
  kind: 'ts',
})

const run = (id, ctx) => coreRules.find((rule) => rule.id === id).run(ctx)

test('S08：契约内的环报一次（锚在环内字典序最小文件），纯外部文件的环不报', () => {
  const records = [record('src/engine/a.ts'), record('src/engine/b.ts')]
  const findings = run(
    'S08',
    context({
      records,
      cycles: [
        ['src/engine/b.ts', 'src/engine/a.ts'],
        ['scripts/x.mjs', 'scripts/y.mjs'],
      ],
    }),
  )
  assert.equal(findings.length, 1, '外部脚本之间的环不属于这份契约')
  assert.equal(findings[0].file, 'src/engine/a.ts', '锚点是环内字典序最小的文件（棘轮靠它）')
  // 报文按**图的遍历顺序**念出环（a → b → a 还是 b → a → b 取决于边的插入顺序），
  // 稳定的只有锚点 —— 棘轮锚的是 file+line，不锚报文。
  assert.match(
    findings[0].text,
    /依赖环：src\/engine\/[ab]\.ts → src\/engine\/[ab]\.ts → src\/engine\/[ab]\.ts/,
  )
})

test('S08：长环的路径被截断（报文不能无限长）', () => {
  const rels = Array.from({ length: 9 }, (_, index) => `src/engine/f${index}.ts`)
  const findings = run('S08', context({ records: rels.map((rel) => record(rel)), cycles: [rels] }))
  assert.equal(findings.length, 1)
  assert.match(findings[0].text, /…/)
  assert.match(findings[0].text, /共 9 个文件/)
})

test('S34：入度与出度各按声明判，同一条记录可以两条都报；没声明就完全不参与', () => {
  const records = [
    { ...record('src/hub/api.ts'), role: 'hub' },
    { ...record('src/leaves/a.ts'), role: 'leaf' },
    { ...record('src/leaves/b.ts'), role: 'leaf' },
  ]
  const edges = new Map([
    ['src/leaves/a.ts', new Set(['src/hub/api.ts', 'src/leaves/b.ts'])],
    ['src/leaves/b.ts', new Set(['src/hub/api.ts'])],
  ])
  const importers = new Map([
    ['src/hub/api.ts', new Set(['src/leaves/a.ts', 'src/leaves/b.ts'])],
    ['src/leaves/b.ts', new Set(['src/leaves/a.ts'])],
  ])
  const build = (limits) => {
    const ctx = context({ records })
    ctx.config.structure.degreeLimits = limits
    ctx.graph = { ...ctx.graph, edges, importers }
    return run('S34', ctx)
  }
  assert.deepEqual(build([]), [], '没声明 → 不参与判定（opt-in）')
  assert.deepEqual(
    build([
      { role: 'hub', maxIn: 1 },
      { role: 'leaf', maxOut: 1 },
    ]).map((f) => `${f.file} ${f.text.slice(0, 2)}`),
    ['src/hub/api.ts 入度', 'src/leaves/a.ts 出度'],
  )
  // 同一个文件两边都超 → 两条
  const both = build([{ role: 'leaf', maxIn: 0, maxOut: 0 }])
  assert.equal(both.filter((f) => f.file === 'src/leaves/b.ts').length, 2)
  // 声明了但没有任何文件命中该角色 → 不报
  assert.deepEqual(build([{ role: 'nobody', maxOut: 0 }]), [])
})
