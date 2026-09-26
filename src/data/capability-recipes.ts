/**
 * **能力根 → "怎么补上它"的可复制片段**（R-106，纯数据）。
 *
 * 为什么要有它：报告的停用清单以前只说"因能力未声明而停用 5 条规则" —— 用户知道少了什么，
 * 但不知道**下一步写哪一行**，只能翻文档全表。这里给每个能力一句可以直接粘进配置的调用。
 *
 * 放在 `data/` 而不是 `presets/`：报告在**引擎**里，引擎不许依赖预置（P1–P4 可移植性自检）。
 * 片段里出现的都是公开 API 的调用形态，不是"宿主字面量"——换范式/换库时这些名字也照旧。
 */
export const CAPABILITY_RECIPES: Record<string, string> = {
  'analytics.apis':
    "analytics({ apis: ['sendEvent'], eventSource: 'src/shared/lib/analytics/events.ts' })",
  'analytics.eventSource':
    "analytics({ apis: ['sendEvent'], eventSource: 'src/shared/lib/analytics/events.ts' })",
  'callSites.groups':
    "callSites([{ name: '本地存储', from: callSiteSources.platform.storage, in: ['src/shared/lib/storage.ts'] }])",
  'dataLayer.queryKeyFrom':
    "dataLayer(reactQueryKit({ queryKeyFrom: ['src/modules/*/model/query.ts'], fetchIn: ['src/modules/*/hooks/**'] }))",
  'dataLayer.fetchIn': "dataLayer(reactQueryKit({ fetchIn: ['src/modules/*/hooks/**'] }))",
  'dataLayer.fetchApis': "dataLayer(reactQueryKit({ fetchApis: ['useQuery'] }))",
  'designSystem.contrastPairs':
    "designSystem({ contrastPairs: [{ fg: '--text-primary', bg: '--surface', usage: '正文', min: 4.5 }] })",
  'designSystem.numberHomes':
    "designSystem({ numberHomes: [{ name: '请求策略', in: ['src/shared/api/queryClient.ts'] }] })",
  'designSystem.paletteFile':
    "designSystem({ paletteFile: 'src/shared/styles/tokens/palette.css' })",
  'designSystem.themeFile': "designSystem({ themeFile: 'src/shared/styles/tokens/theme.css' })",
  'designSystem.tokenDir': "designSystem({ tokenDir: 'src/shared/styles/tokens' })",
  'designSystem.vendorDir': "designSystem({ vendorDir: 'src/shared/styles/vendor' })",
  'designSystem.styleDir': "designSystem({ styleDir: 'src/shared/styles' })  // 范式通常自带",
  'designSystem.staticPrefix': "designSystem({ staticPrefix: '--sh-static-' })",
  'designSystem.storageFile': "designSystem({ storageFile: 'src/shared/lib/storage.ts' })",
  'permissions.source': "permissions({ apis: ['can'], source: 'src/shared/auth/permissions.ts' })",
  'endpoints.source': "endpoints({ apis: ['fetch'], source: 'src/shared/api/endpoints.ts' })",
  'envReads.apis': "envReads({ in: ['src/shared/config/**'] })  // 读取根默认取平台表",
  'envReads.in': "envReads({ in: ['src/shared/config/**'] })",
  'i18n.resourceDir': "i18n(i18nextKit({ languages: ['zh-CN', 'en'] }))",
  'metrics.coverage': "metrics({ coverage: { report: 'coverage/coverage-summary.json' } })",
  'metrics.tests':
    "metrics({ tests: { requireTestsFor: ['src/shared/lib/**'], testGlobs: ['src/**/*.test.ts'], checkChain: { script: 'check', require: ['test', 'coverage'] } } })",
  'metrics.checkChain':
    "metrics({ tests: { checkChain: { script: 'check', require: ['test', 'coverage'] } } })",
  'router.pathSource': "router(reactRouterKit({ pathSource: 'src/shared/config/paths.ts' }))",
  'structure.lazyViews': 'canonical({ lazyViews: true })',
  'structure.slots': 'canonical()  // 槽位语义由应用范式提供（library / fsd 没有）',
  'uiKit.packages': 'uiKit(antdKit())',
  'uiKit.icons': 'uiKit(antdKit())',
  'uiKit.vendorSelectors': 'uiKit(antdKit())',
  'uiKit.detachedApis': 'uiKit(antdKit())',
}

/** 按前缀兜底：上面没逐条列到的能力（同前缀的其它字段）也能给出一句 */
const PREFIX_RECIPES: [string, string][] = [
  ['uiKit.', 'uiKit(antdKit())  // 或你的 kit'],
  ['i18n.', "i18n(i18nextKit({ languages: ['zh-CN', 'en'] }))"],
  [
    'metrics.',
    "metrics({ tests: { requireTestsFor: ['src/shared/lib/**'], testGlobs: ['src/**/*.test.ts'] } })",
  ],
  ['dataLayer.', "dataLayer(reactQueryKit({ queryKeyFrom: ['src/modules/*/model/query.ts'] }))"],
  ['router.', "router(reactRouterKit({ pathSource: 'src/shared/config/paths.ts' }))"],
  ['designSystem.', 'designSystem({ … })  // 落点与刻度都由项目给'],
  ['structure.', 'canonical({ lazyViews: true })  // 结构声明在 overrides.structure 里'],
]

/** 一条"怎么补"的片段；认不出来返回 null（报告就不多说废话） */
export function recipeFor(missing: readonly string[]): string | null {
  for (const capability of missing) {
    const exact = CAPABILITY_RECIPES[capability]
    if (exact) return exact
  }
  for (const capability of missing) {
    for (const [prefix, recipe] of PREFIX_RECIPES) {
      if (capability.startsWith(prefix)) return recipe
    }
  }
  return null
}
