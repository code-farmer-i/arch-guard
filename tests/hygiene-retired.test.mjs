import assert from 'node:assert/strict'
import { test } from 'node:test'

import { coreRules } from '../es/index.js'

/**
 * H12 退路不留：重构后留下的旧实现文件（`CrewsPage.old.tsx` / `useCrewsLegacy.ts`）。
 *
 * 判定只认**整段**命中（标记紧挨扩展名），不认子串 —— 这条测试把两边的边界都钉住。
 */

const rule = coreRules.find((entry) => entry.id === 'H12')
assert.ok(rule, 'H12 不存在')

const findingsFor = (rels) =>
  rule.run({
    config: { params: {}, adapters: {}, roles: [] },
    records: rels.map((rel) => ({ rel })),
    facts: new Map(),
    graph: { edges: new Map(), importers: new Map(), orphaned: [], reachable: new Set() },
    scan: {
      records: [],
      files: [],
      missing: [],
      ambiguous: [],
      exempted: [],
      outside: [],
      foreign: [],
    },
    files: rels,
    sourceOf: () => undefined,
  })

test('H12：整段命中的退路文件要报（分隔符形式 + camelCase 形式）', () => {
  const findings = findingsFor([
    'src/modules/crews/views/CrewsPage.old.tsx',
    'src/modules/crews/hooks/useCrewsLegacy.ts',
    'src/shared/lib/date-util-old.ts',
    'src/shared/config/storage_bak.ts',
    'src/modules/crews/model/typesBackup.ts',
  ])
  assert.deepEqual(
    findings.map((item) => item.file),
    [
      'src/modules/crews/views/CrewsPage.old.tsx',
      'src/modules/crews/hooks/useCrewsLegacy.ts',
      'src/shared/lib/date-util-old.ts',
      'src/shared/config/storage_bak.ts',
      'src/modules/crews/model/typesBackup.ts',
    ],
  )
  assert.match(findings[2].text, /old/)
})

test('H12：子串不算、目录名不算、正常模块不报', () => {
  assert.deepEqual(
    findingsFor([
      'src/shared/lib/legacy-support.ts', // 给旧环境兜底的正常模块
      'src/shared/lib/threshold.ts', // 末尾正好是 "old"，但不是一整段
      'src/modules/crews/lib/old-crews.ts', // 标记不在末尾（保守：先不报）
      'src/legacy/crews/routes.ts', // 迁移期容器：目录名不参与判定
      'src/modules/crews/views/CrewsPage.tsx',
    ]),
    [],
  )
})
