import type {
  Adapter,
  DataLayerAdapter,
  I18nAdapter,
  Preset,
  RouterAdapter,
  StylesAdapter,
} from '../engine/types.js'

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
    enable: ['D10', 'D10b', 'P05', 'P11', 'H06', 'P12'],
    adapters: { [adapter.facet]: adapter },
  }
}

/** i18n 适配器：C 域的规则集由 `copy()` 启用，这里只提供能力（落点 / 调用形态 / 语言声明） */
export function i18n(adapter: I18nAdapter): Preset {
  return { enable: SOLUTION_RULES, adapters: { i18n: adapter } }
}

/**
 * P12 = "登记的方案面不许混入同类库"（判据来自 `src/data/solution-alternatives.ts`）。
 * 三个方案面各自贡献它 —— 装了适配器却一条不跑是静默失效。
 */
const SOLUTION_RULES = ['P12']

/** 路由适配器：`router(reactRouterKit())` */
export function router(adapter: RouterAdapter): Preset {
  return { enable: SOLUTION_RULES, adapters: { [adapter.facet]: adapter } }
}

/** 数据层适配器：`dataLayer(reactQueryKit())` */
export function dataLayer(adapter: DataLayerAdapter): Preset {
  return { enable: SOLUTION_RULES, adapters: { [adapter.facet]: adapter } }
}

/** 样式适配器：`styles(cssModulesKit())` */
export function styles(adapter: StylesAdapter): Preset {
  return { enable: SOLUTION_RULES, adapters: { [adapter.facet]: adapter } }
}
