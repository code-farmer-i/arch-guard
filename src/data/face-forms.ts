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
