/**
 * 方案面的**默认形态**（范式 / 社区约定，纯数据，不含任何库名）。
 *
 * 为什么单列一张表：`routes.tsx` 与 `*.module.css` 这两处词汇以前**写死在规则里**，
 * 而范式的角色表写的是 `routes.{ts,tsx}` —— 两边一漂，入口叫 `routes.ts` 的域就会被
 * S04 / S05 / S15 误报成「跨域引用内部文件」「view 没被本域 routes 引用」。
 * 真相只留这一份：规则从这里取默认值，适配器（`presets/router-kits`、`presets/styles-kits`）
 * 也声明同一份，声明了就盖过它（见 `packs/core/rules/face-forms.ts`）。
 */

/**
 * 域的**公开面入口**文件名：`modules/<域>/routes.{ts,tsx}`（见 `canonical()` 的角色表）。
 *
 * 只收代码扩展名：`routes.css` / `routes.json` 不是公开面 —— 与 `fsd()` 的入口只认代码扩展名同理。
 */
export const DEFAULT_ROUTE_FILES: string[] = ['routes.ts', 'routes.tsx']

/**
 * **组件样式**（CSS Module）的文件形态正则：`*.module.css`。
 *
 * 声明成正则而不是后缀，是因为换方案时变的是**形态**：`*.module.scss`、
 * `*.module.css?inline`、`*.module.less` 都是同一个方案的不同写法。
 */
export const DEFAULT_MODULE_PATTERNS: string[] = ['\\.module\\.css$']

/**
 * **缓存键属性名**（数据层方案）：`useQuery({ queryKey: [...] })` 里的 `queryKey`。
 * 值本身由**项目**决定（`data-layer` 面的 `queryKeyProps`），这里只是默认形态。
 */
export const DEFAULT_QUERY_KEY_PROPS: string[] = ['queryKey']

/**
 * 承载**路由路径**的属性名：路由表的 `{ path: '/crews' }` 与链接的 `<Link to="/crews" />`。
 * 只认以 `/` 开头的绝对路径 —— 嵌套路由的相对段（`path: 'detail'`）是另一种东西。
 */
export const DEFAULT_PATH_PROPS: string[] = ['path', 'to']

/**
 * 触发**跳转**的调用名：`navigate('/crews')` / `router.push('/crews')` /
 * `history.replace('/crews')` —— 它们的第一个字符串实参也是路径落点。
 */
export const DEFAULT_NAVIGATE_CALLS: string[] = [
  'navigate',
  'router.push',
  'router.replace',
  'history.push',
  'history.replace',
]

/**
 * **方案面的字段清单**（`fields`）—— 全仓唯一出处。
 *
 * 以前 `router` 与 `styles` 的字段各自被**两个 kit 声明了一遍**（`none` 与真实 kit 都要注册这个面），
 * 于是"面有几个字段"有两处真相：一个 kit 加了字段、另一个仍按旧清单注册就会悄悄覆盖回去
 * （`defineFacet` 后写者胜）。现在每个 kit 都从这里取清单，只有一处要改。
 */
export const FACET_FIELDS = {
  router: ['packages', 'routeFiles', 'pathSource', 'pathProps', 'navigateCalls', 'examples'],
  styles: ['packages', 'modulePatterns', 'examples'],
} as const
