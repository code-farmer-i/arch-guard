import type { Adapter, I18nAdapter, Preset } from '../engine/types.js'

/**
 * 适配器预设：**把一份纯数据适配器装进配置**（`uiKit(antdKit())` / `i18n(i18nextKit())`）。
 *
 * 拆成独立模块是为了让 `stack()` 能引用它们而不与 `presets/index.ts` 形成循环依赖。
 * 两者都遵循同一条规矩：**适配器贡献它自己的规则集**（`enable`），否则就是
 * "装了适配器却一条不跑"的静默失效；规则是否真的跑仍由**能力协商**决定。
 */

/** 组件库适配器：`uiKit.vendorSelectors` → D10/D10b · `uiKit.icons` → P05 · `uiKit.packages` → P11 · `uiKit.detachedApis` → H06 */
export function uiKit(adapter: Adapter): Preset {
  return {
    enable: ['D10', 'D10b', 'P05', 'P11', 'H06'],
    adapters: { [adapter.facet]: adapter },
  }
}

/** i18n 适配器：C 域的规则集由 `copy()` 启用，这里只提供能力（落点 / 调用形态 / 语言声明） */
export function i18n(adapter: I18nAdapter): Preset {
  return { adapters: { i18n: adapter } }
}
