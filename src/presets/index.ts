import type { Adapter, I18nAdapter, Preset } from '../engine/types.js'

export { canonical, roleTable, type CanonicalOptions } from './canonical.js'
export { library, libraryRoleTable, type LibraryOptions } from './library.js'
export { fsd, fsdRoleTable, type FsdOptions } from './fsd.js'
export { designSystem, deps, type DesignSystemOptions, type DepsOptions } from './design-system.js'
export { copy } from './copy.js'
export { i18nextKit, type I18nextKitOptions } from './i18n-kits/i18next.js'
export { noneI18nKit } from './i18n-kits/none.js'
export { metrics, type CoverageOptions, type MetricsOptions, type PerDirMin } from './metrics.js'
export { hygiene } from './hygiene.js'
export { antdKit } from './ui-kits/antd.js'
export { noneKit } from './ui-kits/none.js'

/** 把一个适配器包成预设：`uiKit(antdKit())` */
/**
 * 注册一个 i18n 适配器（与 `uiKit(adapter)` 同形）。
 * `copy()` 只贡献 C 域规则集，能力从这里来 —— 换 i18n 方案就换这个 kit。
 */
export function i18n(adapter: I18nAdapter): Preset {
  return { adapters: { i18n: adapter } }
}

export function uiKit(adapter: Adapter): Preset {
  /**
   * 适配器是**数据**，但读它的规则得先被启用 —— 否则就是"装了组件库适配器，规则一条不跑"的静默失效
   * （实测：`fsd() + uiKit(antdKit())` 时 `.ant-btn` 出现在 vendor 之外不报）。所以这里声明它贡献的规则集：
   * `uiKit.vendorSelectors` → D10/D10b · `uiKit.icons` → P05 · `uiKit.packages` → P11 · `uiKit.detachedApis` → H06。
   * 规则是否真的跑仍由**能力协商**决定（适配器没给那个字段就停用并明确报出来）。
   */
  return {
    enable: ['D10', 'D10b', 'P05', 'P11', 'H06'],
    adapters: { [adapter.facet]: adapter },
  }
}
