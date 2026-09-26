import { DEFAULT_IGNORE, DEFAULT_NAMING, DEFAULT_THRESHOLDS } from '../engine/defaults.js'
import type { Preset, RoleDescriptor } from '../engine/types.js'

export interface CanonicalOptions {
  /** 源码根，默认 src */
  src?: string
  /** 装配层：main / App / router / layouts */
  app?: string
  /** 业务域根：每个子目录是一个域 */
  modules?: string
  /** 跨域共享层 */
  shared?: string
  /**
   * **页面必须动态 import**（`lazy: () => import('./views/X')`）→ 启用 S37。
   *
   * 场景：路由表静态 import 页面 → 所有页面进主包，首屏跟着变大。
   * 声明了才判（没声明 → S37 明列停用）：有些应用就是不分包。
   */
  lazyViews?: boolean
}

/**
 * 范式约定的角色表（见 PARADIGM.md「目录契约」）。
 * 判据只用「路径」，因此判定等级是 L1；每个文件必须**恰好命中一个角色**。
 * 层号用于依赖方向（`shared` 内部是线性层序，只许向下）。
 */
export function roleTable(options: CanonicalOptions = {}): RoleDescriptor[] {
  const src = options.src ?? 'src'
  const app = options.app ?? `${src}/app`
  const modules = options.modules ?? `${src}/modules`
  const shared = options.shared ?? `${src}/shared`

  return [
    // 测试与类型声明优先占位（排他），避免和槽位角色冲突
    { id: 'test', pattern: `**/*.test.{ts,tsx,mts,cts,js,mjs,cjs}`, layer: 99, exclusive: true },
    { id: 'test', pattern: `**/*.spec.{ts,tsx,mts,cts,js,mjs,cjs}`, layer: 99, exclusive: true },
    { id: 'test', pattern: `**/__tests__/**`, layer: 99, exclusive: true },
    { id: 'dts', pattern: `${src}/*.d.ts`, layer: 0, exclusive: true },

    // 装配层
    { id: 'app:bootstrap', pattern: `${app}/main.{ts,tsx}`, layer: 11, slot: 'bootstrap' },
    { id: 'app:bootstrap', pattern: `${app}/App.{ts,tsx}`, layer: 11, slot: 'bootstrap' },
    { id: 'app:router', pattern: `${app}/router/**`, layer: 11, slot: 'router' },
    { id: 'app:layouts', pattern: `${app}/layouts/**`, layer: 11, slot: 'layouts' },

    // 业务域：七个槽位 + 唯一入口 routes
    // `group: 'domain'`：域就是这套范式的**组维度** —— 不声明的话，按组判定的规则
    // （S22 组隔离 / S23 公开面 / S26 组数量 / S28 外部引用下限 / S32 导入局部性）
    // 在应用范式下会集体沉默（它们读的是 `record.groupName`）。
    {
      id: 'module:routes',
      pattern: `${modules}/{domain}/routes.{ts,tsx}`,
      layer: 10,
      slot: 'routes',
      group: 'domain',
      // 域的**公开面入口**：S03 的题目就是「域根目录只许域的公开面入口」，routes 就是这个入口 ——
      // 不标 entry 的话，S23（公开面）在应用范式下同样不生效（与 group 那次是同一个根因）
      entry: true,
    },
    {
      // **业务公开面**（R-98）：域想对外提供实体/工具时，这里就是合法通道（S04/S05 认 `entry` 角色）。
      // 没有它的话，跨域协作的唯一出路是"把东西抬进 shared" —— 而 shared 会因此长成第二套 modules。
      id: 'module:index',
      pattern: `${modules}/{domain}/index.{ts,tsx}`,
      layer: 10,
      slot: 'index',
      group: 'domain',
      entry: true,
    },
    {
      id: 'module:views',
      pattern: `${modules}/{domain}/views/**`,
      layer: 10,
      slot: 'views',
      pageLike: true,
      group: 'domain',
    },
    {
      id: 'module:components',
      pattern: `${modules}/{domain}/components/**`,
      layer: 10,
      slot: 'components',
      group: 'domain',
    },
    {
      id: 'module:hooks',
      pattern: `${modules}/{domain}/hooks/**`,
      layer: 10,
      slot: 'hooks',
      group: 'domain',
    },
    {
      id: 'module:model',
      pattern: `${modules}/{domain}/model/**`,
      layer: 10,
      slot: 'model',
      group: 'domain',
    },
    {
      id: 'module:lib',
      pattern: `${modules}/{domain}/lib/**`,
      layer: 10,
      slot: 'lib',
      group: 'domain',
    },
    {
      id: 'module:assets',
      pattern: `${modules}/{domain}/assets/**`,
      layer: 10,
      slot: 'assets',
      group: 'domain',
    },

    // 共享层：内部线性层序（0 最低）
    { id: 'shared:styles', pattern: `${shared}/styles/**`, layer: 0, slot: 'styles' },
    { id: 'shared:assets', pattern: `${shared}/assets/**`, layer: 0, slot: 'assets' },
    { id: 'shared:lib', pattern: `${shared}/lib/**`, layer: 1, slot: 'lib' },
    { id: 'shared:config', pattern: `${shared}/config/**`, layer: 2, slot: 'config' },
    { id: 'shared:i18n', pattern: `${shared}/i18n/**`, layer: 3, slot: 'i18n' },
    { id: 'shared:api', pattern: `${shared}/api/**`, layer: 4, slot: 'api' },
    { id: 'shared:stores', pattern: `${shared}/stores/**`, layer: 5, slot: 'stores' },
    { id: 'shared:theme', pattern: `${shared}/theme/**`, layer: 6, slot: 'theme' },
    { id: 'shared:hooks', pattern: `${shared}/hooks/**`, layer: 7, slot: 'hooks' },
    { id: 'shared:components:ui', pattern: `${shared}/components/ui/**`, layer: 8, slot: 'ui' },
    {
      id: 'shared:components:common',
      pattern: `${shared}/components/common/**`,
      layer: 8,
      slot: 'common',
    },
  ]
}

/** 范式 canonical 预设：目录契约 + 命名 + 阈值 + 层序 */
export function canonical(options: CanonicalOptions = {}): Preset {
  const src = options.src ?? 'src'
  const app = options.app ?? `${src}/app`
  const modules = options.modules ?? `${src}/modules`
  const shared = options.shared ?? `${src}/shared`

  return {
    paradigm: 'canonical',
    // 三根范式的**契约落点**：范式负责声明自己的惯用目录，域预设（designSystem 等）不再塞默认值 ——
    // 这样 `[fsd(), designSystem()]` 不会被悄悄改回三根路径
    params: {
      // 本范式**带槽位语义**（views / hooks / model / lib）→ S13 才有东西可判
      slots: true,
      // 只有项目声明了才判（见 CanonicalOptions.lazyViews）：S37 的开关
      ...(options.lazyViews ? { lazyViews: true } : {}),
      styleDir: `${src}/shared/styles`,
      tokenDir: `${src}/shared/styles/tokens`,
      vendorDir: `${src}/shared/styles/vendor`,
      paletteFile: `${src}/shared/styles/tokens/palette.css`,
      themeFile: `${src}/shared/styles/tokens/theme.css`,
      storageFile: `${src}/shared/config/storage.ts`,
      i18nDir: `${src}/shared/i18n/locales`,
    },
    // 应用范式默认**全开**：显式写出来，与其它预设贡献的域取并集时仍是 'all'
    // （不写的话，`canonical() + hygiene()` 的并集会被 hygiene 的列表顶成只有 H 域）
    enable: 'all',
    // 层序也走**通用规则**（S21）：shared 0–8 线性层序 + 域/装配层方向，一套机制管到底。
    // 它比原先的 S07 更严：`shared → modules`、`modules → app` 这类向上依赖以前没人管。
    structure: { order: true },
    roles: roleTable({ src, app, modules, shared }),
    layout: { app, modules, shared },
    srcRoot: src,
    // 阈值与命名契约取自**唯一默认值**（engine/defaults.ts）：这里不再抄一份数字，
    // 否则改默认值要记得改三处（引擎兜底 / canonical / library），漏一处就是静默漂移。
    naming: { ...DEFAULT_NAMING },
    thresholds: { ...DEFAULT_THRESHOLDS },
    entries: [`${app}/main.tsx`],
    // 契约扫描域：只有 src 下的 ts/css 参与角色判定。域外（vite.config.ts / e2e / scripts /
    // 生成代码）既不该被要求"落位"，也不该每次全量解析；但它们仍留在文件集里供 import 解析。
    include: [`${src}/**`],
    // 门禁自身的配置文件不属于项目源码树
    ignore: [...DEFAULT_IGNORE],
  }
}
