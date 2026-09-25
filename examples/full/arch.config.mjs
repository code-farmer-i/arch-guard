/**
 * **完整形态的宿主配置**（范式 + 5 个域 + 8 个方案面 + 结构声明）。
 *
 * 每个声明指向的文件都真的存在 —— 所以 `skipped` 里不该有东西：
 * 报告末尾那句"因能力未声明而停用 N 条规则"应该消失，声明写错也会被 `declaration-no-match` 点名。
 * 与 `examples/minimal` 的区别：minimal 只证明"能跑"，这份演示"配全之后长什么样"。
 */
import {
  analytics,
  antdKit,
  callSites,
  callSiteSources,
  canonical,
  copy,
  cssModulesKit,
  dataLayer,
  deps,
  designSystem,
  envReads,
  hygiene,
  metrics,
  i18n,
  i18nextKit,
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
    // ① 范式：三根拓扑 + 23 个角色 + 落点参数（styleDir / tokenDir / paletteFile / i18nDir… 都由它给）
    canonical({ lazyViews: true }),

    // ② 五个域
    designSystem({
      staticPrefix: '--sh-static-',
      storageFile: 'src/shared/lib/storage.ts',
      valueWhitelists: [
        { rule: 'D12', allow: ['4px', '8px', '16px'] },
        { rule: 'D13', allow: ['1', '10'] },
        { rule: 'D14', allow: ['150ms'] },
      ],
      numberHomes: [
        // 名字不用写：staleTime / retry / gcTime… 是 react-query 的事实（reactQueryKit 的 numberNames）。
        // 家可以有多处，且支持 glob：全局兜底在 shared，各域自己的时效跟着域走（R-97 / A3）
        {
          name: '请求策略',
          in: ['src/shared/api/queryClient.ts', 'src/modules/*/model/query.ts'],
        },
        // 项目自己的常量仍然要列
        { name: '分页阈值', names: ['PAGE_SIZE'], in: ['src/shared/config/constants.ts'] },
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
        'react-router-dom',
      ],
      capabilities: { datetime: 'dayjs' },
      unusedDeps: true,
    }),
    hygiene(),
    metrics({
      // **故意不声明 `coverage`**：M02–M06 要一份「比最近一次提交还新」的覆盖率产物（M06 fail-closed），
      // 而入库的产物必然比它的提交旧 —— 本仓自己的 arch.config.mjs 也是因此不声明 coverage。
      // 真实项目里它由 `pnpm coverage` 生成，配法见 docs/USAGE.md §2.2。
      tests: {
        requireTestsFor: ['src/shared/lib/**'],
        testGlobs: ['src/**/*.test.ts'],
        checkChain: { script: 'check', require: ['test', 'coverage'] },
      },
      depsBudget: { runtime: 10 },
    }),

    // ③ 八个方案面
    uiKit(antdKit()),
    i18n(i18nextKit({ languages: ['zh-CN', 'en'] })),
    router(reactRouterKit({ pathSource: 'src/shared/config/paths.ts' })),
    dataLayer(
      reactQueryKit({
        // 键跟着域走（R-97）：一行 glob 覆盖所有域，不再集中在一个 shared 文件里
        queryKeyFrom: ['src/modules/*/model/query.ts'],
        // fetchApis 不用写：reactQueryKit 自带全套钩子（R-92 后不再因"这次没用到"被点名）
        fetchIn: ['src/modules/*/hooks/**', 'src/shared/api/**'],
      }),
    ),
    styles(cssModulesKit()),
    analytics({ apis: ['sendEvent'], eventSource: 'src/shared/lib/analytics/events.ts' }),
    // 读取根（import.meta.env / process.env）是平台表给的，项目只说"只许在哪读"
    envReads({ in: ['src/shared/config/**'] }),
    // 组名 + 家在哪就够了：localStorage 是平台的事实、gtag 是 analytics 面已声明的、QueryClient 是 kit 的
    callSites([
      { name: '本地存储', from: callSiteSources.platform.storage, in: ['src/shared/lib/storage.ts'] },
      { name: '埋点上报', from: callSiteSources.analytics.gtag, in: ['src/shared/lib/analytics/**'] },
      { name: '全局单例', from: callSiteSources.dataLayer.singletons, in: ['src/shared/api/queryClient.ts'] },
    ]),
  ],

  overrides: {
    include: ['src/**'],
    ignore: ['dist/**', 'coverage/**'],

    // ④ 结构声明（只写这个项目真有、且真的能命中的形态）
    structure: {
      order: true,
      isolate: ['domain'],
      publicApi: ['domain'],
      segmentedGroups: ['domain'],
      reservedNames: ['ui', 'utils', 'common'],
      groupCountLimits: [{ dimension: 'domain', max: 20 }],
      directoryItemLimits: [{ role: 'module:components', max: 15 }],
      nameCollisions: [{ dimension: 'domain', vocabularyRoles: ['module:components'] }],
      repetitiveNaming: ['domain'],
      pluralConsistency: [{ dimension: 'domain', neutralWords: ['billing'] }],
      degreeLimits: [{ role: 'shared:lib', maxIn: 30 }],
      couplingLimits: [{ dimension: 'domain', maxFanIn: 6, maxFanOut: 6 }],
      importLocality: ['domain'],
      clientState: [{ naming: 'use*Store', in: ['src/shared/stores/**'] }],
      authRedirects: { loginPaths: ['/login'], in: ['src/app/router/guards/**'] },
      maxRelativeUp: { max: 2 },
      generated: ['src/shared/api/generated/**'],
    },

    // ⑤ 项目自己的目录 / dev-only 形态（`addRoles` 是**追加**，不是替换）
    addRoles: [{ id: 'test', pattern: '**/*.stories.{ts,tsx}', layer: 99, exclusive: true }],

    exceptions: [],
  },
}
