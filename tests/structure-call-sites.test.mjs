import assert from 'node:assert/strict'
import { test } from 'node:test'

import { callSites, coreRules } from '../es/index.js'

/**
 * 两个前端场景的分支：
 * - S36 取数只在声明的落点（页面里 useQuery / 域里 fetch）
 * - S37 页面必须动态 import（路由表静态 import → 全部进主包）
 */

const rule = (id) => {
  const found = coreRules.find((entry) => entry.id === id)
  assert.ok(found, `规则 ${id} 不存在`)
  return found
}

const config = (adapters = {}, params = {}) => ({
  root: '/tmp/scenario-gates',
  srcRoot: 'src',
  paradigm: 'canonical',
  adapters,
  params,
  layout: { app: 'src/app', modules: 'src/modules', shared: 'src/shared' },
  roles: [],
  thresholds: {},
  naming: {},
  entries: [],
  ignore: [],
  aliases: {},
})

const context = ({ cfg, records = [], facts = {}, files = [], importers = {} }) => ({
  config: cfg,
  records,
  facts: new Map(Object.entries(facts)),
  graph: {
    edges: new Map(),
    importers: new Map(Object.entries(importers).map(([rel, list]) => [rel, new Set(list)])),
    orphaned: [],
    reachable: new Set(),
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
  files,
  sourceOf: () => undefined,
})

const calls = (...entries) =>
  entries.map(([callee, line]) => ({ callee, line: line ?? 1, stringArg: undefined }))

/* ---------------- S36 ---------------- */

const dataConfig = (fetchIn) =>
  config({
    'data-layer': {
      facet: 'data-layer',
      id: 'x',
      fetchApis: ['useQuery', 'invalidateQueries'],
      ...(fetchIn ? { fetchIn } : {}),
    },
  })

test('S36：落点外取数要报，落点内 / 测试文件不报', () => {
  const cfg = dataConfig(['src/modules/*/hooks/**', 'src/shared/api/**'])
  const findings = rule('S36').run(
    context({
      cfg,
      records: [
        { rel: 'src/modules/crews/views/CrewsPage.tsx', role: 'module:views' },
        { rel: 'src/modules/crews/hooks/useCrews.ts', role: 'module:hooks' },
        { rel: 'src/modules/crews/hooks/useCrews.test.ts', role: 'test' },
      ],
      facts: {
        'src/modules/crews/views/CrewsPage.tsx': { calls: calls(['useQuery', 4]), imports: [] },
        'src/modules/crews/hooks/useCrews.ts': { calls: calls(['useQuery', 5]), imports: [] },
        'src/modules/crews/hooks/useCrews.test.ts': { calls: calls(['useQuery', 3]), imports: [] },
      },
    }),
  )
  assert.deepEqual(
    findings.map((item) => item.file),
    ['src/modules/crews/views/CrewsPage.tsx'],
    '只有页面里那次要报：落点内与测试文件都放过',
  )
})

test('S36：方法名按 `.` 后缀匹配（queryClient.invalidateQueries）', () => {
  const cfg = dataConfig(['src/modules/*/hooks/**'])
  const findings = rule('S36').run(
    context({
      cfg,
      records: [{ rel: 'src/modules/crews/views/CrewsPage.tsx', role: 'module:views' }],
      facts: {
        'src/modules/crews/views/CrewsPage.tsx': {
          calls: calls(['queryClient.invalidateQueries', 9], ['console.log', 10]),
          imports: [],
        },
      },
    }),
  )
  assert.equal(findings.length, 1, '接收者变量名由项目决定，所以匹配后缀')
  assert.match(findings[0].text, /queryClient\.invalidateQueries/)
})

test('S36：没声明落点或 API 清单时不判（真跑时由 requires 明列停用）', () => {
  const records = [{ rel: 'src/modules/crews/views/CrewsPage.tsx', role: 'module:views' }]
  const facts = {
    'src/modules/crews/views/CrewsPage.tsx': { calls: calls(['useQuery', 1]), imports: [] },
  }
  assert.deepEqual(rule('S36').run(context({ cfg: dataConfig(undefined), records, facts })), [])
  assert.deepEqual(
    rule('S36').run(
      context({
        cfg: config({ 'data-layer': { facet: 'data-layer', id: 'x', packages: [] } }),
        records,
        facts,
      }),
    ),
    [],
  )
})

/* ---------------- S37 ---------------- */

const ROUTES = 'src/modules/crews/routes.ts'
const VIEW = 'src/modules/crews/views/CrewsPage.tsx'
const OTHER = 'src/modules/crews/views/Other.tsx'

const lazyConfig = (lazyViews) => config({}, lazyViews ? { lazyViews: true } : {})

test('S37：入口静态 import 页面要报，动态 import 不报', () => {
  const cfg = lazyConfig(true)
  const build = (dynamic) =>
    context({
      cfg,
      records: [
        { rel: ROUTES, slot: 'routes', role: 'module:routes' },
        { rel: VIEW, slot: 'views', role: 'module:views' },
      ],
      files: [ROUTES, VIEW],
      importers: { [VIEW]: [ROUTES] },
      facts: {
        [ROUTES]: {
          calls: [],
          imports: [{ spec: './views/CrewsPage', line: 2, typeOnly: false, dynamic }],
        },
      },
    })

  const bad = rule('S37').run(build(false))
  assert.equal(bad.length, 1)
  assert.equal(bad[0].file, ROUTES, '锚在入口那一行（改法在那儿）')
  assert.match(bad[0].text, /静态 import/)
  assert.deepEqual(rule('S37').run(build(true)), [], '懒加载合规')
})

test('S37：组件之间互相引用不管；没声明 lazyViews 不判', () => {
  const cfg = lazyConfig(true)
  const componentImporter = context({
    cfg,
    records: [
      { rel: OTHER, slot: 'views', role: 'module:views' },
      { rel: VIEW, slot: 'views', role: 'module:views' },
    ],
    files: [OTHER, VIEW],
    importers: { [VIEW]: [OTHER] },
    facts: { [OTHER]: { calls: [], imports: [{ spec: './CrewsPage', line: 1, dynamic: false }] } },
  })
  assert.deepEqual(rule('S37').run(componentImporter), [], '页面互相引用不是首屏问题')

  const withoutDeclaration = context({
    cfg: lazyConfig(false),
    records: [
      { rel: ROUTES, slot: 'routes', role: 'module:routes' },
      { rel: VIEW, slot: 'views', role: 'module:views' },
    ],
    files: [ROUTES, VIEW],
    importers: { [VIEW]: [ROUTES] },
    facts: {
      [ROUTES]: { calls: [], imports: [{ spec: './views/CrewsPage', line: 2, dynamic: false }] },
    },
  })
  assert.deepEqual(rule('S37').run(withoutDeclaration), [], '没声明就明列停用，不空转')
})

/* ---------------- S38 + 预设 ---------------- */

const callSiteConfig = (groups) =>
  config(
    groups
      ? { 'call-sites': { facet: 'call-sites', id: 'declared', groups } }
      : { 'call-sites': { facet: 'call-sites', id: 'declared' } },
  )

test('S38：按组判落点 —— 副作用组前缀匹配、配置对象组整名匹配，封装里与测试文件不报', () => {
  const cfg = callSiteConfig([
    { name: '副作用', apis: ['localStorage', 'gtag'], in: ['src/shared/lib/storage.ts'] },
    { name: '配置对象', apis: ['QueryClient'], in: ['src/app/**'] },
  ])
  const findings = rule('S38').run(
    context({
      cfg,
      records: [
        { rel: 'src/modules/crews/views/CrewsPage.tsx', role: 'module:views' },
        { rel: 'src/modules/crews/lib/queryClient.ts', role: 'module:lib' },
        { rel: 'src/app/main.tsx', role: 'app:bootstrap' },
        { rel: 'src/shared/lib/storage.ts', role: 'shared:lib' },
        { rel: 'src/modules/crews/hooks/useCrews.test.ts', role: 'test' },
      ],
      facts: {
        'src/modules/crews/views/CrewsPage.tsx': {
          calls: calls(['localStorage.getItem', 2], ['gtag', 3]),
          imports: [],
        },
        // `new QueryClient()` 在 facts 里同样是 calls（NewExpression）—— 整名匹配
        'src/modules/crews/lib/queryClient.ts': { calls: calls(['QueryClient', 4]), imports: [] },
        'src/app/main.tsx': { calls: calls(['QueryClient', 3]), imports: [] },
        'src/shared/lib/storage.ts': { calls: calls(['localStorage.setItem', 1]), imports: [] },
        'src/modules/crews/hooks/useCrews.test.ts': {
          calls: calls(['localStorage.clear', 1]),
          imports: [],
        },
      },
    }),
  )
  assert.deepEqual(
    findings.map((item) => `${item.file} :: ${item.text.match(/（([^）]+)）/)?.[1]}`),
    [
      'src/modules/crews/views/CrewsPage.tsx :: localStorage.getItem',
      'src/modules/crews/views/CrewsPage.tsx :: gtag',
      'src/modules/crews/lib/queryClient.ts :: QueryClient',
    ],
    '装配层与共享层各是落点、测试文件豁免',
  )
  assert.match(findings[2].text, /调用配置对象 API/, '报告里带组名（副作用 / 配置对象一眼分开）')
})

test('S38：没声明组时不判（真跑时由 requires 明列停用）', () => {
  assert.deepEqual(
    rule('S38').run(
      context({
        cfg: callSiteConfig(undefined),
        records: [{ rel: 'src/modules/crews/views/CrewsPage.tsx', role: 'module:views' }],
        facts: {
          'src/modules/crews/views/CrewsPage.tsx': { calls: calls(['gtag', 1]), imports: [] },
        },
      }),
    ),
    [],
  )
})

test('callSites()：每组两样都要给，空值 / 重名 / 空清单一律 fail-closed', () => {
  const preset = callSites([
    { name: '副作用', apis: ['gtag'], in: ['src/shared/lib/analytics.ts'] },
    { name: '配置对象', apis: ['QueryClient'], in: ['src/app/**'] },
  ])
  assert.deepEqual(preset.enable, ['S38'], '装了预设就要启用消费它的规则')
  assert.deepEqual(preset.adapters?.['call-sites']?.groups?.[0]?.apis, ['gtag'])

  assert.throws(() => callSites([]), /至少要给一组/)
  assert.throws(() => callSites([{ name: '副作用', apis: [], in: ['x'] }]), /apis 不能为空/)
  assert.throws(() => callSites([{ name: '副作用', apis: ['gtag'], in: [] }]), /in 不能为空/)
  assert.throws(() => callSites([{ name: '', apis: ['gtag'], in: ['x'] }]), /缺少 name/)
  assert.throws(
    () =>
      callSites([
        { name: '副作用', apis: ['gtag'], in: ['x'] },
        { name: '副作用', apis: ['Sentry'], in: ['y'] },
      ]),
    /组名要唯一/,
  )
})
