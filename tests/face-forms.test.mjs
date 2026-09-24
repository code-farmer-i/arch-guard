import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  coreRules,
  cssModulesKit,
  noneRouterKit,
  noneStylesKit,
  reactRouterKit,
} from '../es/index.js'
import { DEFAULT_MODULE_PATTERNS, DEFAULT_ROUTE_FILES } from '../es/data/face-forms.js'
import {
  isModuleStyle,
  modulePatternsOf,
  patternRegex,
  routeEntriesOf,
  routeFilesOf,
} from '../es/packs/core/rules/face-forms.js'

/**
 * 方案面**形态**词汇（`router.routeFiles` / `styles.modulePatterns`）：默认值、覆盖、空清单语义。
 *
 * 空清单不是"没配"，而是**声明这种文件不存在**（文件路由 / Tailwind）—— 语义写错就会变成
 * 用 `routes.tsx` 去量一个不存在的约定（误报），或者域根谁都不看着（静默失能）。
 */

const config = (adapters = {}, extra = {}) => ({
  root: '/tmp/face-forms',
  srcRoot: 'src',
  paradigm: 'canonical',
  layout: { app: 'src/app', modules: 'src/modules', shared: 'src/shared' },
  roles: [],
  params: { styleDir: 'src/shared/styles' },
  adapters,
  naming: {},
  thresholds: {},
  entries: [],
  ignore: [],
  aliases: {},
  ...extra,
})

const ruleById = (id) => {
  const rule = coreRules.find((entry) => entry.id === id)
  assert.ok(rule, `规则 ${id} 不存在`)
  return rule
}

test('方案面词汇：默认值取自 data/face-forms，适配器声明盖过默认值', () => {
  assert.deepEqual(
    DEFAULT_ROUTE_FILES,
    ['routes.ts', 'routes.tsx'],
    '与角色表 routes.{ts,tsx} 对齐',
  )
  assert.deepEqual(DEFAULT_MODULE_PATTERNS, ['\\.module\\.css$'])

  assert.deepEqual(routeFilesOf(config()), DEFAULT_ROUTE_FILES, '没声明 router 面 → 默认词汇')
  assert.deepEqual(
    routeFilesOf(config({ router: { facet: 'router', routeFiles: ['entry.ts'] } })),
    ['entry.ts'],
    '声明了就听声明的',
  )
  assert.deepEqual(
    routeFilesOf(config({ router: { facet: 'router', routeFiles: [] } })),
    [],
    '空清单要**原样**返回（它是"本方案没有这种文件"的声明，不是没配）',
  )

  assert.deepEqual(modulePatternsOf(config()), DEFAULT_MODULE_PATTERNS)
  assert.deepEqual(
    modulePatternsOf(
      config({ styles: { facet: 'styles', modulePatterns: ['\\.module\\.scss$'] } }),
    ),
    ['\\.module\\.scss$'],
  )
  assert.deepEqual(
    modulePatternsOf(config({ styles: { facet: 'styles', modulePatterns: [] } })),
    [],
  )
})

test('方案面词汇：域的入口路径按 layout 拼，形态匹配走真正则（编译结果有缓存）', () => {
  assert.deepEqual(routeEntriesOf(config(), 'crews'), [
    'src/modules/crews/routes.ts',
    'src/modules/crews/routes.tsx',
  ])
  assert.deepEqual(
    routeEntriesOf(config({ router: { facet: 'router', routeFiles: [] } }), 'crews'),
    [],
  )

  const scss = ['\\.module\\.scss$']
  assert.equal(isModuleStyle('src/shared/ui/Card.module.scss', scss), true)
  assert.equal(isModuleStyle('src/shared/ui/Card.module.css', scss), false, '别的形态不算数')
  assert.equal(isModuleStyle('src/shared/ui/globals.css', DEFAULT_MODULE_PATTERNS), false)
  assert.equal(
    patternRegex('\\.module\\.css$'),
    patternRegex('\\.module\\.css$'),
    '同一正则只编译一次',
  )
})

test('方案面 kit：声明的形态与默认一致；自定义正则必须自带 hit / miss 样例', () => {
  assert.deepEqual(reactRouterKit().routeFiles, DEFAULT_ROUTE_FILES)
  assert.deepEqual(noneRouterKit().routeFiles, DEFAULT_ROUTE_FILES, '"不用路由库" ≠ "没有域入口"')
  assert.deepEqual(cssModulesKit().modulePatterns, DEFAULT_MODULE_PATTERNS)
  assert.deepEqual(noneStylesKit().modulePatterns, DEFAULT_MODULE_PATTERNS)

  // 正则类字段的样例会拿**真正则**去验证：不给样例 = 写歪了没人知道，所以构造期就报
  assert.throws(
    () => cssModulesKit({ modulePatterns: ['\\.module\\.scss$'] }),
    /必须同时给 examples/,
  )
  assert.throws(
    () =>
      cssModulesKit({
        modulePatterns: ['\\.module\\.scss$'],
        examples: { modulePatterns: { hit: ['a.module.css'], miss: ['b.tsx'] } },
      }),
    /命中/,
    '样例与声明不符（hit 不匹配）也要在构造期报',
  )
  assert.deepEqual(
    cssModulesKit({
      modulePatterns: ['\\.module\\.scss$'],
      examples: {
        modulePatterns: { hit: ['src/ui/Card.module.scss'], miss: ['src/ui/Card.tsx'] },
      },
    }).modulePatterns,
    ['\\.module\\.scss$'],
  )
})

const scan = (missing = []) => ({
  records: [],
  files: [],
  missing,
  ambiguous: [],
  exempted: [],
  outside: [],
  foreign: [],
})

test('S03：域根散件照报 —— 入口词汇为空时也不放行（S01 已把域根让给 S03）', () => {
  const rule = ruleById('S03')
  const withDefault = rule.run({
    config: config(),
    scan: scan(['src/modules/crews/helpers.ts']),
    records: [],
    facts: new Map(),
    graph: { edges: new Map(), importers: new Map() },
  })
  assert.equal(withDefault.length, 1)
  assert.match(withDefault[0].text, /routes\.ts \/ routes\.tsx/)
  assert.match(withDefault[0].hint, /域根只放 routes\.ts \/ routes\.tsx/)

  /**
   * 名字在词汇里、但**没命中任何角色** → 报的是"角色表没跟上"，不是"域根散件"。
   * 真宿主的 `routes.ts` 会命中 `module:routes` 角色，因此不会落到这一支（S03 只看 `scan.missing`）。
   */
  const roleless = rule.run({
    config: config(),
    scan: scan(['src/modules/crews/routes.ts']),
    records: [],
    facts: new Map(),
    graph: { edges: new Map(), importers: new Map() },
  })
  assert.equal(roleless.length, 1)
  assert.match(roleless[0].text, /不在目录契约内/)
  assert.doesNotMatch(roleless[0].text, /出现了/, '这不是"域根散件"，别说成"出现了某个文件"')

  // 文件路由（声明 [] ）：没有入口文件名，但域根散件**照报**，只是文案变了
  const empty = rule.run({
    config: config({ router: { facet: 'router', routeFiles: [] } }),
    scan: scan(['src/modules/crews/helpers.ts']),
    records: [],
    facts: new Map(),
    graph: { edges: new Map(), importers: new Map() },
  })
  assert.equal(empty.length, 1)
  assert.match(empty[0].text, /本方案未声明入口文件/)
  assert.match(empty[0].hint, /域根不该有文件/)
})

test('路线规则：入口词汇为空时不判（不是"用默认词汇硬判"）', () => {
  const edges = new Map([
    ['src/modules/crews/routes.ts', new Set(['src/modules/orders/routes.ts'])],
  ])
  const records = [
    { rel: 'src/modules/crews/routes.ts', domain: 'crews', slot: 'routes' },
    { rel: 'src/modules/orders/routes.ts', domain: 'orders', slot: 'routes' },
  ]
  const graph = { edges, importers: new Map(), orphaned: [], reachable: new Set() }
  const base = {
    records,
    facts: new Map(),
    graph,
    scan: scan(),
    sourceOf: () => undefined,
    deps: { declared: new Set(), used: new Set() },
    policy: {},
    files: [],
  }

  // 默认词汇：跨域只经入口 → 不报
  for (const id of ['S04', 'S05']) {
    assert.equal(
      ruleById(id).run({ ...base, config: config() }).length,
      0,
      `${id}：经对方 routes.ts 入口是允许的`,
    )
    assert.equal(
      ruleById(id).run({ ...base, config: config({ router: { facet: 'router', routeFiles: [] } }) })
        .length,
      0,
      `${id}：声明"没有域入口文件"时不判`,
    )
  }

  // D16 / D17：声明"没有组件样式文件"（Tailwind）时也不判
  const cssRecords = [{ rel: 'src/shared/components/ui/x.css', kind: 'css' }]
  const designBase = {
    ...base,
    records: cssRecords,
    scan: scan(),
  }
  assert.equal(
    ruleById('D16').run({ ...designBase, config: config() }).length,
    1,
    '默认形态：组件目录里的裸 CSS 要报',
  )
  assert.equal(
    ruleById('D16').run({
      ...designBase,
      config: config({ styles: { facet: 'styles', modulePatterns: [] } }),
    }).length,
    0,
  )
  // D17 的"违规必报"那半边：组件样式文件没有被任何组件 import
  assert.equal(
    ruleById('D17').run({
      ...designBase,
      records: [{ rel: 'src/shared/components/ui/x.module.css', kind: 'css' }],
      config: config(),
    }).length,
    1,
    '默认形态：没人 import 的 module.css 要报',
  )
  assert.equal(
    ruleById('D17').run({
      ...designBase,
      records: [{ rel: 'src/shared/components/ui/x.module.css', kind: 'css' }],
      config: config({ styles: { facet: 'styles', modulePatterns: [] } }),
    }).length,
    0,
  )
})

test('S15③：view 必须被**本域入口**引用 —— 入口叫 routes.ts 时照样认得', () => {
  const records = [
    { rel: 'src/modules/crews/routes.ts', domain: 'crews', slot: 'routes', role: 'module:routes' },
    {
      rel: 'src/modules/crews/views/CrewsPage.tsx',
      domain: 'crews',
      slot: 'views',
      role: 'module:views',
    },
  ]
  const base = {
    records,
    facts: new Map(),
    graph: { edges: new Map(), importers: new Map(), orphaned: [], reachable: new Set() },
    scan: scan(),
    sourceOf: () => undefined,
    config: config(),
  }
  const findings = ruleById('S15').run(base)
  assert.equal(findings.length, 1, '入口在、但没引用这个 view → 报')
  assert.match(findings[0].text, /view 没有被 src\/modules\/crews\/routes\.ts 引用/)

  // 真被入口引用时不报（入口是 routes.ts，不是 routes.tsx）
  const referenced = ruleById('S15').run({
    ...base,
    graph: {
      ...base.graph,
      importers: new Map([
        ['src/modules/crews/views/CrewsPage.tsx', new Set(['src/modules/crews/routes.ts'])],
      ]),
    },
  })
  assert.equal(referenced.length, 0)
})

/* ---------------- 自定义入口名：kit 参数 + 角色表没跟上时怎么报 ---------------- */

const ctxOf = ({ records = [], missing = [], importers = new Map(), cfg = config() }) => ({
  config: cfg,
  records,
  facts: new Map(),
  graph: { edges: new Map(), importers, orphaned: [], reachable: new Set() },
  scan: { ...scan(missing), records: [], files: [] },
  sourceOf: () => undefined,
  files: [],
})

test('kit 参数：自定义入口词汇（含空清单）由 kit 自己声明，仍走 defineAdapter 校验', () => {
  assert.deepEqual(reactRouterKit({ routeFiles: ['entry.ts'] }).routeFiles, ['entry.ts'])
  assert.deepEqual(reactRouterKit({ routeFiles: [] }).routeFiles, [], '空清单也原样声明')
  assert.deepEqual(reactRouterKit().routeFiles, DEFAULT_ROUTE_FILES, '不传就照默认')
  assert.deepEqual(noneRouterKit({ routeFiles: [] }).routeFiles, [])
  assert.deepEqual(noneRouterKit().routeFiles, DEFAULT_ROUTE_FILES)
})

test('自定义入口名：存在性按词汇判（S14 / S15② 不再看角色 slot），角色表没跟上由 S03 说清', () => {
  const cfg = config({ router: { facet: 'router', routeFiles: ['entry.ts'] } })
  const view = {
    rel: 'src/modules/crews/views/CrewsPage.tsx',
    domain: 'crews',
    slot: 'views',
    role: 'module:views',
  }
  const entry = 'src/modules/crews/entry.ts'
  const appRouter = { rel: 'src/app/router/index.ts', role: 'app:router', slot: 'router' }

  // S14：入口在文件集里（虽然它没有角色）→ 不报「有 views 但没有 entry.ts」
  assert.equal(
    ruleById('S14').run(ctxOf({ records: [view], missing: [entry], cfg })).length,
    0,
    '存在性按词汇判，不看角色 slot（否则入口一改名就假阳性）',
  )

  // S03：名字对但没角色 = 角色表没跟上 → 报一句能照着改的话
  const gap = ruleById('S03').run(ctxOf({ missing: [entry], cfg }))
  assert.equal(gap.length, 1)
  assert.match(gap[0].text, /域入口 entry\.ts 不在目录契约内/)
  assert.match(gap[0].hint, /addRoles/)

  // S15②：入口没被 app 聚合要报（按词汇认入口，不看 slot）
  const notAggregated = ruleById('S15').run(ctxOf({ records: [appRouter], missing: [entry], cfg }))
  assert.equal(notAggregated.length, 1)
  assert.match(notAggregated[0].text, /域入口没有被 app\/router 聚合/)
  assert.equal(
    ruleById('S15').run(
      ctxOf({
        records: [appRouter],
        missing: [entry],
        importers: new Map([[entry, new Set(['src/app/router/index.ts'])]]),
        cfg,
      }),
    ).length,
    0,
  )

  // S15③：入口没进契约（没被解析、图上没有它的边）时**不误报** view 没人引用 —— 那是 S03 的活
  assert.equal(
    ruleById('S15').run(ctxOf({ records: [view], missing: [entry], cfg })).length,
    0,
    '入口没进解析集时不拿它判「谁引用了 view」',
  )
})

test('词汇与角色表不一致的另一半：角色表把别的文件当域入口 → S03 也要报', () => {
  const stale = {
    rel: 'src/modules/crews/routes.tsx',
    domain: 'crews',
    slot: 'routes',
    role: 'module:routes',
  }
  const cfg = config({ router: { facet: 'router', routeFiles: ['entry.ts'] } })
  const findings = ruleById('S03').run(ctxOf({ records: [stale], cfg }))
  assert.equal(findings.length, 1, '角色表说 routes.tsx 是入口，词汇说 entry.ts —— 两处真相要报')
  assert.match(findings[0].text, /词汇与角色表不一致/)

  // 一致时（默认词汇 + 默认角色表）不报
  assert.equal(ruleById('S03').run(ctxOf({ records: [stale], cfg: config() })).length, 0)
  // 词汇为空（文件路由）时不判这条反向
  assert.equal(
    ruleById('S03').run(
      ctxOf({ records: [stale], cfg: config({ router: { facet: 'router', routeFiles: [] } }) }),
    ).length,
    0,
  )
})
