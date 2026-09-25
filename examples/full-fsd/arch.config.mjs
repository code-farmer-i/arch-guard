/**
 * **FSD 版的"完整配置"样板**（与 `examples/full` 对称：那边是 `canonical()` 三根拓扑）。
 *
 * 差别全在**落点**上，规则一条不用改：
 * - 层级与切片：`fsd()` 自带六层角色表 + `structure`（层序 / 切片隔离 / 公开面 / 片段封闭枚举 /
 *   组维度 slice 的阈值…），这里只补它没声明的几条（导入局部性 / 出入度 / 耦合 / 状态与守卫落点…）；
 * - 落点参数：`styleDir=src/app/styles`、`tokenDir=src/app/styles/tokens`、
 *   `i18nDir=src/shared/i18n/locales`、`storageFile=src/shared/config/storage.ts` —— 都由 `fsd()` 声明；
 * - 唯一出处：路径进 `src/shared/routes/paths.ts`、缓存键进 `src/shared/api/queryKeys.ts`、
 *   事件名进 `src/shared/lib/analytics/events.ts`。
 */
import {
  analytics,
  antdKit,
  callSites,
  callSiteSources,
  copy,
  cssModulesKit,
  dataLayer,
  deps,
  designSystem,
  envReads,
  fsd,
  hygiene,
  i18n,
  i18nextKit,
  metrics,
  reactPack,
  reactQueryKit,
  reactRouterKit,
  router,
  styles,
  uiKit,
} from '../../es/index.js'

export default {
  specVersion: '1',
  packs: [reactPack],

  presets: [
    fsd(),

    designSystem({
      staticPrefix: '--sh-static-',
      valueWhitelists: [
        { rule: 'D12', allow: ['4px', '8px', '16px'] },
        { rule: 'D13', allow: ['1', '10'] },
        { rule: 'D14', allow: ['150ms'] },
      ],
      numberHomes: [
        // 名字不用写：staleTime / retry / gcTime… 是 react-query 的事实（reactQueryKit 的 numberNames）
        { name: '请求策略', in: ['src/shared/api/queryClient.ts'] },
        // 项目自己的常量仍然要列
        { name: '分页阈值', names: ['PAGE_SIZE', 'ORDER_PAGE_SIZE'], in: ['src/shared/config/constants.ts'] },
      ],
      contrastPairs: [{ fg: '--text-primary', bg: '--surface', usage: '正文', min: 4.5 }],
    }),
    // 文案位名单由 `uiKit(antdKit())` 给（antd 的事实），项目自己的封装才需要在这里写：
    // `copy({ messageApis: ['appToast.success'] })` —— 写了就以项目为准，`[]` = 关掉那一半。
    copy(),
    deps({
      allow: [
        '@tanstack/react-query',
        'antd',
        'dayjs',
        'i18next',
        'react',
        'react-dom',
        'react-i18next',
        'react-router',
        'react-router-dom',
        '@ant-design/icons',
      ],
      capabilities: { datetime: 'dayjs' },
      unusedDeps: true,
    }),
    hygiene(),
    metrics({
      // 同 `examples/full`：故意不声明 coverage —— M06 要一份比最近一次提交还新的产物，入库的必然过期。
      tests: {
        // 只点名"必须有测试"的那两块：`shell` store 依赖 react（本示例不装依赖，node --test 跑不起来），
        // 真实项目里当然该给它配测试 —— 这里把要求收窄到能跑得动的地方。
        requireTestsFor: ['src/shared/lib/storage.ts', 'src/shared/lib/analytics/**'],
        testGlobs: ['src/**/*.test.ts'],
        checkChain: { script: 'check', require: ['test', 'coverage'] },
      },
      depsBudget: { runtime: 10 },
    }),

    uiKit(antdKit()),
    i18n(i18nextKit({ languages: ['zh-CN', 'en'] })),
    router(reactRouterKit({ pathSource: 'src/shared/routes/paths.ts' })),
    dataLayer(
      reactQueryKit({
        queryKeyFrom: 'src/shared/api/queryKeys.ts',
        // fetchApis 不用写：reactQueryKit 自带全套钩子（R-92 后不再因"这次没用到"被点名）
        fetchIn: ['src/pages/*/api/**', 'src/shared/api/**'],
      }),
    ),
    styles(cssModulesKit()),
    analytics({ apis: ['sendEvent'], eventSource: 'src/shared/lib/analytics/events.ts' }),
    // 读取根（import.meta.env / process.env）是平台表给的，项目只说"只许在哪读"
    envReads({ in: ['src/shared/config/**'] }),
    // 组名 + 家在哪就够了；`from` 用常量（编辑器补全 / 拼错立刻可见 / 可重构）
    callSites([
      { name: '本地存储', from: callSiteSources.platform.storage, in: ['src/shared/lib/storage.ts'] },
      { name: '埋点上报', from: callSiteSources.analytics.gtag, in: ['src/shared/lib/analytics/**'] },
      { name: '全局单例', from: callSiteSources.dataLayer.singletons, in: ['src/shared/api/queryClient.ts'] },
    ]),
  ],

  overrides: {
    include: ['src/**'],
    // `fsd()` 已经把切片维度那套声明给全了；这里只补它没声明的
    structure: {
      importLocality: ['slice'],
      degreeLimits: [{ role: 'fsd:shared:lib', maxIn: 30 }],
      couplingLimits: [{ dimension: 'slice', maxFanIn: 6, maxFanOut: 6 }],
      clientState: [{ naming: 'use*Store', in: ['src/shared/lib/shell/**'] }],
      authRedirects: { loginPaths: ['/login'], in: ['src/app/router/guards/**'] },
      maxRelativeUp: { max: 2 },
      generated: ['src/shared/api/generated/**'],
    },
  },
}
