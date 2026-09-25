import assert from 'node:assert/strict'
import { test } from 'node:test'

import { callSites, coreRules } from '../es/index.js'

/**
 * 「形态 + 落点」一族：
 * - S41 状态单元只在声明的落点（导出名形态 + 落点）
 * - S42 跳转守卫只在声明的落点（字符串实参 / JSX `to`）
 * - R-46 权限判断：复用 S38 的 callSites（这里顺带钉住"高层 API 到哪都合法"）
 */

const rule = (id) => {
  const found = coreRules.find((entry) => entry.id === id)
  assert.ok(found, `规则 ${id} 不存在`)
  return found
}

const config = (structure = {}) => ({
  root: '/tmp/discipline',
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
  aliases: {},
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
    clientState: [],
    authRedirects: undefined,
    ...structure,
  },
})

const record = (rel, layer = 3) => ({
  rel,
  abs: `/tmp/discipline/${rel}`,
  role: 'module:crews',
  layer,
  domain: 'crews',
  slot: null,
  captures: { domain: 'crews' },
  group: null,
  groupName: null,
  kind: 'ts',
})

const context = ({ cfg, records = [], exports = {}, calls = [], strings = [] }) => ({
  config: cfg,
  records,
  files: records.map((item) => item.rel),
  facts: new Map(
    records.map((item) => [
      item.rel,
      {
        comments: [],
        exports: exports[item.rel] ?? [],
        functions: [],
        calls: calls.filter((c) => c.rel === item.rel),
        strings: strings.filter((s) => s.rel === item.rel),
      },
    ]),
  ),
  graph: {
    edges: new Map(),
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
  policy: { allow: [], deny: [], capabilities: {}, fingerprints: [] },
  sourceOf: () => undefined,
})

const withRel = (rel, item) => ({ rel, ...item })

/* ---------------- S41 ---------------- */

test('S41：命名形态命中但不在落点 → 报；落点内不报；不命中命名不报', () => {
  const cfg = config({ clientState: [{ naming: 'use*Store', in: ['src/modules/*/stores/**'] }] })
  const findings = rule('S41').run(
    context({
      cfg,
      records: [
        record('src/modules/crews/stores/useCrewsStore.ts'),
        record('src/modules/crews/hooks/useOrdersStore.ts'),
        record('src/modules/crews/hooks/useCrews.ts'),
      ],
      exports: {
        'src/modules/crews/stores/useCrewsStore.ts': [{ name: 'useCrewsStore', line: 1 }],
        'src/modules/crews/hooks/useOrdersStore.ts': [{ name: 'useOrdersStore', line: 2 }],
        'src/modules/crews/hooks/useCrews.ts': [
          { name: 'useCrews', line: 1 },
          { name: 'createStore', line: 9 },
        ],
      },
    }),
  )
  assert.equal(findings.length, 1)
  assert.equal(findings[0].file, 'src/modules/crews/hooks/useOrdersStore.ts')
  assert.equal(findings[0].line, 2)
})

test('S41：没声明不判；声明了但落点为空数组在配置阶段就报错', () => {
  assert.deepEqual(
    rule('S41').run(
      context({
        cfg: config(),
        records: [record('src/modules/crews/hooks/useOrdersStore.ts')],
        exports: {
          'src/modules/crews/hooks/useOrdersStore.ts': [{ name: 'useOrdersStore', line: 1 }],
        },
      }),
    ),
    [],
  )
})

/* ---------------- S42 ---------------- */

test('S42：页面里的 navigate(\'/login\') 与 to="/login" 都报，守卫落点里不报', () => {
  const cfg = config({ authRedirects: { loginPaths: ['/login'], in: ['src/app/guards/**'] } })
  const findings = rule('S42').run(
    context({
      cfg,
      records: [
        record('src/app/guards/RequireAuth.tsx'),
        record('src/modules/crews/views/CrewsPage.tsx'),
        record('src/modules/orders/views/OrdersPage.tsx'),
      ],
      calls: [
        withRel('src/app/guards/RequireAuth.tsx', {
          callee: 'navigate',
          line: 2,
          stringArg: '/login',
        }),
        withRel('src/modules/crews/views/CrewsPage.tsx', {
          callee: 'navigate',
          line: 3,
          stringArg: '/login',
        }),
        withRel('src/modules/crews/views/CrewsPage.tsx', {
          callee: 'navigate',
          line: 4,
          stringArg: '/crews',
        }),
      ],
      strings: [
        withRel('src/modules/orders/views/OrdersPage.tsx', {
          value: '/login',
          line: 2,
          context: 'jsx',
          prop: 'to',
        }),
        withRel('src/modules/crews/views/CrewsPage.tsx', {
          value: '/crews',
          line: 5,
          context: 'jsx',
          prop: 'to',
        }),
      ],
    }),
  )
  assert.deepEqual(
    findings.map((item) => `${item.file}:${item.line}`),
    ['src/modules/crews/views/CrewsPage.tsx:3', 'src/modules/orders/views/OrdersPage.tsx:2'],
    '只有页面里的两种形态报；守卫落点里、以及非登录路径都不报',
  )
})

test('S42：没声明不判；跳别的路径（/logout）不算守卫', () => {
  const base = {
    records: [record('src/modules/crews/views/CrewsPage.tsx')],
    calls: [
      withRel('src/modules/crews/views/CrewsPage.tsx', {
        callee: 'navigate',
        line: 1,
        stringArg: '/logout',
      }),
    ],
  }
  assert.deepEqual(rule('S42').run(context({ cfg: config(), ...base })), [])
  assert.deepEqual(
    rule('S42').run(
      context({
        cfg: config({ authRedirects: { loginPaths: ['/login'], in: ['src/app/guards/**'] } }),
        ...base,
      }),
    ),
    [],
    '跳到 /logout 不是"未登录跳登录"',
  )
})

/* ---------------- R-46：权限判断复用 S38 ---------------- */

test('R-46：原始权限形态用 callSites 声明后，落点外报；高层 API 到哪都合法', () => {
  const preset = callSites([
    { name: '权限判断', apis: ['permissions.includes'], in: ['src/shared/auth/**'] },
  ])
  assert.deepEqual(preset.enable, ['S38'])
  const cfg = config()
  cfg.adapters = preset.adapters
  const findings = rule('S38').run(
    context({
      cfg,
      records: [
        record('src/shared/auth/permissions.ts'),
        record('src/modules/crews/views/CrewsPage.tsx'),
      ],
      calls: [
        withRel('src/shared/auth/permissions.ts', { callee: 'permissions.includes', line: 2 }),
        withRel('src/modules/crews/views/CrewsPage.tsx', {
          callee: 'permissions.includes',
          line: 3,
        }),
        withRel('src/modules/crews/views/CrewsPage.tsx', { callee: 'can', line: 4 }),
      ],
    }),
  )
  assert.deepEqual(
    findings.map((item) => `${item.file}:${item.line}`),
    ['src/modules/crews/views/CrewsPage.tsx:3'],
    '高层 API（can）不在清单里 → 不报',
  )
})
