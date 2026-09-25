import assert from 'node:assert/strict'
import { test } from 'node:test'

import { coreRules } from '../es/index.js'
import { StructureDeclarationError, resolveStructure } from '../es/engine/structure.js'

/**
 * 两条声明驱动的边界规则：
 * - S39 组耦合上限（fan-in 上帝域 / fan-out 什么都碰）
 * - S40 迁移中的目录只出不进
 */

const rule = (id) => {
  const found = coreRules.find((entry) => entry.id === id)
  assert.ok(found, `规则 ${id} 不存在`)
  return found
}

const config = (structure = {}) => ({
  root: '/tmp/boundaries',
  srcRoot: 'src',
  paradigm: 'canonical',
  adapters: {},
  params: {},
  layout: { app: 'src/app', modules: 'src/modules', shared: 'src/shared' },
  roles: [],
  thresholds: {},
  naming: {},
  entries: [],
  ignore: [],
  aliases: { '@': 'src' }, // 与 fixture 的 tsconfig paths 等价：@/x → src/x
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
    degreeLimits: [],
    importLocality: [],
    couplingLimits: [],
    migrating: [],
    ...structure,
  },
})

const record = (rel, domain, layer = 3) => ({
  rel,
  abs: `/tmp/boundaries/${rel}`,
  role: `module:${domain}`,
  layer,
  domain,
  slot: null,
  captures: { domain },
  group: null,
  groupName: null,
  kind: 'ts',
})

const context = ({ cfg, records = [], edges = {}, facts = {}, files = [] }) => ({
  config: cfg,
  records,
  files: files.length > 0 ? files : records.map((item) => item.rel),
  facts: new Map(Object.entries(facts)),
  graph: {
    edges: new Map(Object.entries(edges).map(([rel, list]) => [rel, new Set(list)])),
    importers: new Map(),
    unresolved: new Map(),
    externals: new Map(),
    orphaned: [],
    reachable: new Set(),
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
  deps: { declared: [], installed: [] },
  policy: { allow: [], deny: [], capabilities: {} },
  sourceOf: () => undefined,
})

const calls = (pairs) => ({
  imports: pairs.map(([spec, line, dynamic]) => ({
    spec,
    line,
    typeOnly: false,
    dynamic: Boolean(dynamic),
  })),
})

/* ---------------- S39 ---------------- */

test('S39：fan-in 超过上限报（锚在参与度最高的文件），没超的不报', () => {
  const cfg = config({ couplingLimits: [{ dimension: 'domain', maxFanIn: 1 }] })
  const findings = rule('S39').run(
    context({
      cfg,
      records: [
        record('src/modules/crews/components/CrewCard.tsx', 'crews'),
        record('src/modules/crews/components/CrewRow.tsx', 'crews'),
        record('src/modules/orders/views/OrdersPage.tsx', 'orders'),
        record('src/modules/users/views/UsersPage.tsx', 'users'),
        record('src/modules/reports/views/ReportsPage.tsx', 'reports'),
      ],
      edges: {
        'src/modules/orders/views/OrdersPage.tsx': ['src/modules/crews/components/CrewCard.tsx'],
        'src/modules/users/views/UsersPage.tsx': ['src/modules/crews/components/CrewCard.tsx'],
        'src/modules/reports/views/ReportsPage.tsx': ['src/modules/crews/components/CrewRow.tsx'],
      },
    }),
  )
  assert.equal(findings.length, 1, '只有被 3 个组依赖的 crews 超限')
  assert.equal(
    findings[0].file,
    'src/modules/crews/components/CrewCard.tsx',
    '锚在被 2 个组引用的那个文件',
  )
  assert.match(findings[0].text, /组「crews」被 3 个组依赖（上限 1）/)
})

test('S39：fan-out 与 fan-in 分别计数，不互相污染；同组内部互引不计', () => {
  const cfg = config({ couplingLimits: [{ dimension: 'domain', maxFanOut: 1 }] })
  const findings = rule('S39').run(
    context({
      cfg,
      records: [
        record('src/modules/reports/views/ReportsPage.tsx', 'reports'),
        record('src/modules/reports/lib/helpers.ts', 'reports'),
        record('src/modules/orders/routes.tsx', 'orders'),
        record('src/modules/users/routes.tsx', 'users'),
      ],
      edges: {
        // reports 依赖 2 个组 → 超限；同组内部互引（helpers）不算
        'src/modules/reports/views/ReportsPage.tsx': [
          'src/modules/orders/routes.tsx',
          'src/modules/users/routes.tsx',
          'src/modules/reports/lib/helpers.ts',
        ],
      },
    }),
  )
  assert.equal(findings.length, 1)
  assert.match(findings[0].text, /组「reports」依赖了 2 个组（上限 1）：orders、users/)
  assert.doesNotMatch(findings[0].text, /reports、/, '同组内部互引不该出现在对端里')
})

test('S39：没声明维度 / 上限未超 / 测试角色（layer ≥ 90）都不报', () => {
  const base = {
    records: [
      record('src/modules/crews/routes.tsx', 'crews'),
      record('src/modules/orders/views/OrdersPage.tsx', 'orders'),
    ],
    edges: { 'src/modules/orders/views/OrdersPage.tsx': ['src/modules/crews/routes.tsx'] },
  }
  assert.deepEqual(rule('S39').run(context({ cfg: config(), ...base })), [], '没声明不判')
  assert.deepEqual(
    rule('S39').run(
      context({ cfg: config({ couplingLimits: [{ dimension: 'domain', maxFanIn: 5 }] }), ...base }),
    ),
    [],
    '上限没超不报',
  )
  const withTest = {
    records: [...base.records, record('src/modules/users/x.test.ts', 'users', 99)],
    edges: { ...base.edges, 'src/modules/users/x.test.ts': ['src/modules/crews/routes.tsx'] },
  }
  assert.deepEqual(
    rule('S39').run(
      context({
        cfg: config({ couplingLimits: [{ dimension: 'domain', maxFanIn: 1 }] }),
        ...withTest,
      }),
    ),
    [],
    '测试文件引用不计入耦合',
  )
})

test('S39 / S40：声明校验在解析配置时拦下（维度不真实 / 上限都不给 / 空 glob）', () => {
  const roles = [{ id: 'm', pattern: 'src/modules/{domain}/**', layer: 3 }]
  const expectError = (structure, pattern) =>
    assert.throws(
      () => resolveStructure({ preset: structure, roles }),
      (error) => {
        assert.ok(error instanceof StructureDeclarationError)
        assert.match(error.message, pattern)
        return true
      },
    )
  expectError({ couplingLimits: [{ dimension: 'nope', maxFanIn: 1 }] }, /不是任何角色的捕获名/)
  expectError({ couplingLimits: [{ dimension: 'domain' }] }, /什么都没说/)
  expectError({ couplingLimits: [{ dimension: 'domain', maxFanIn: 0 }] }, /必须是 ≥1 的整数/)
  expectError({ migrating: ['   '] }, /非空 glob/)
})

/* ---------------- S40 ---------------- */

test('S40：外面引用迁移中的文件要报；迁移中的文件引用外面不报', () => {
  const cfg = config({ migrating: ['src/legacy/**'] })
  const findings = rule('S40').run(
    context({
      cfg,
      records: [
        record('src/modules/crews/lib/price.ts', 'crews'),
        record('src/modules/orders/lib/orders.ts', 'orders'),
      ],
      files: [
        'src/modules/crews/lib/price.ts',
        'src/modules/orders/lib/orders.ts',
        'src/legacy/pricing.ts',
      ],
      edges: {},
      facts: {
        'src/modules/crews/lib/price.ts': calls([['@/legacy/pricing', 2]]),
        'src/modules/orders/lib/orders.ts': calls([['@/shared/lib/format', 1]]),
      },
    }),
  )
  assert.equal(findings.length, 1)
  assert.equal(findings[0].file, 'src/modules/crews/lib/price.ts')
  assert.equal(findings[0].line, 2)
  assert.match(findings[0].text, /引用了迁移中的文件：src\/legacy\/pricing\.ts/)
})

test('S40：没声明 / 声明没命中任何文件 / 迁移中互引，都不报', () => {
  const base = {
    records: [record('src/modules/crews/lib/price.ts', 'crews')],
    files: ['src/modules/crews/lib/price.ts', 'src/legacy/pricing.ts'],
    facts: { 'src/modules/crews/lib/price.ts': calls([['@/legacy/pricing', 1]]) },
  }
  assert.deepEqual(rule('S40').run(context({ cfg: config(), ...base })), [], '没声明不判')
  assert.deepEqual(
    rule('S40').run(
      context({
        cfg: config({ migrating: ['src/old/**'] }),
        ...base,
        files: [...base.files, 'src/old/thing.ts'],
      }),
    ),
    [],
    '声明没命中任何文件（可能刚迁完）不报',
  )
})
