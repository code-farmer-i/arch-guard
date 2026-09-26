import type {
  Adapter,
  DataLayerAdapter,
  HttpAdapter,
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
 * 装了适配器却一条不跑是静默失效，所以每个方案面各自贡献它的规则集：
 * - `router` 面还带来 **D23 路由路径唯一出处**（声明了 `pathSource` 才真的判）
 * - `data-layer` 面还带来 **D22 缓存键唯一出处** 与
 *   **S36 取数只在声明的落点**（声明了 `queryKeyFrom` / `fetchIn` 才真的判）
 * - `styles` 面今天只贡献 P12：形态类判定（D16 / D17）的家是 `designSystem()`
 */
const SOLUTION_RULES = ['P12']

/** 路由适配器：`router(reactRouterKit({ pathSource: 'src/shared/config/paths.ts' }))` */
export function router(adapter: RouterAdapter): Preset {
  return { enable: [...SOLUTION_RULES, 'D23'], adapters: { [adapter.facet]: adapter } }
}

/** 数据层适配器：`dataLayer(reactQueryKit({ queryKeyFrom: 'src/shared/api/queryKeys.ts' }))` */
export function dataLayer(adapter: DataLayerAdapter): Preset {
  // D26（缓存键形状）也用 `dataLayer.queryKeyFrom` 这个受体 —— 装了适配器就一并启用
  return {
    enable: [...SOLUTION_RULES, 'D22', 'D26', 'S36'],
    adapters: { [adapter.facet]: adapter },
  }
}

/**
 * HTTP 客户端适配器：`http(axiosKit())`。
 *
 * 装了它才有"**哪些调用算打后端**"这份库事实：`endpoints({ from: callSiteSources.http.apis })`
 * 从它取（以前只有平台来源表里的 `fetch` / `XMLHttpRequest`，用 axios 的项目会静默不判）。
 * 与 `router()` 同形：一并登记 D25，是否真的判仍由 `endpoints.source` 那份能力协商决定。
 */
export function http(adapter: HttpAdapter): Preset {
  return { enable: [...SOLUTION_RULES, 'D25'], adapters: { [adapter.facet]: adapter } }
}

/** 样式适配器：`styles(cssModulesKit())` */
export function styles(adapter: StylesAdapter): Preset {
  return { enable: SOLUTION_RULES, adapters: { [adapter.facet]: adapter } }
}
