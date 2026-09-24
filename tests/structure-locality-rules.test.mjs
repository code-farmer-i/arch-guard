import assert from 'node:assert/strict'
import { test } from 'node:test'

import { coreRules } from '../es/index.js'

/** S32 需要：真实说明符 + 别名 + 事实里的 imports */
function localityContext({ records, imports, aliases = {} }) {
  const facts = new Map(
    Object.entries(imports).map(([rel, list]) => [
      rel,
      { imports: list.map(([spec, line]) => ({ spec, line, typeOnly: false, dynamic: false })) },
    ]),
  )
  const edges = new Map()
  const importers = new Map()
  return {
    config: {
      root: '/tmp/locality',
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
        importLocality: ['slice'],
      },
      entries: [],
      ignore: [],
      aliases,
    },
    records,
    facts,
    graph: {
      edges,
      importers,
      externals: new Map(),
      unresolved: new Map(),
      reachable: new Set(),
      orphaned: [],
      cycles: [],
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
    files: records.map((record) => record.rel),
    sourceOf: () => undefined,
  }
}

test('S32：四个方向（同组相对合规 / 跨组相对报 / 同组别名报 / 跨组别名合规）+ 解析不到就跳过', () => {
  const record = (rel, group, layer) => ({
    rel,
    abs: `/tmp/locality/${rel}`,
    role: 'x',
    layer,
    domain: null,
    slot: null,
    captures: { slice: group },
    group,
    groupName: 'slice',
    kind: 'ts',
  })
  const records = [
    record('src/features/a/ui/A.tsx', 'a', 3),
    record('src/features/a/ui/B.tsx', 'a', 3),
    record('src/features/b/ui/C.tsx', 'b', 3),
  ]
  const ctx = localityContext({
    records,
    aliases: { '@': 'src' },
    imports: {
      'src/features/a/ui/A.tsx': [
        ['./B', 1],
        ['../../b/ui/C', 2],
        ['@/features/a/ui/B', 3],
        ['@/features/b/ui/C', 4],
        ['../../nowhere/Missing', 5],
        ['react', 6],
      ],
    },
  })
  const findings = coreRules.find((rule) => rule.id === 'S32').run(ctx)
  assert.deepEqual(
    findings.map((finding) => [finding.line, finding.text.startsWith('跨组') ? '跨组' : '同组']),
    [
      [2, '跨组'],
      [3, '同组'],
    ],
  )
})
