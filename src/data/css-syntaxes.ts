/**
 * **样式文件的扩展名 → 解析语法（纯数据）**。
 *
 * 这是"哪些扩展名归样式管"与"用什么语法解析它们"的**唯一出处**：
 * `CSS_EXTENSIONS`（扫描/图解析）与 `engine/css.ts` 的解析器选择都从这张表派生 ——
 * 以前扩展名写在 `scan.ts` 的常量里、语法写在解析器里，是两处真相。
 *
 * 为什么需要"语法"这一列：`.scss` / `.less` 的专有写法（`#{$x}` / `@{x}` / `//` 注释）在
 * **标准 CSS 解析器下直接抛错**，而这两种扩展名本来就在扫描范围内（`cssModulesKit` 的
 * `modulePatterns` 文档也明确支持 `*.module.scss`）—— 不区分语法就等于"宿主用了 Sass 就红"。
 *
 * 这里只写**语法名**（`css` / `scss` / `less`），不写库名：库名与解析器的绑定在
 * `src/engine/css.ts`（数据表是知识，不是实现；见 ADR-0002）。
 */
export type CssSyntaxId = 'css' | 'scss' | 'less'

export interface CssSyntax {
  /** 带点的扩展名（`kindOf` 用 `endsWith` 判，与 TS 扩展名同一套口径） */
  extension: string
  syntax: CssSyntaxId
}

export const cssSyntaxes: CssSyntax[] = [
  { extension: '.css', syntax: 'css' },
  { extension: '.scss', syntax: 'scss' },
  { extension: '.less', syntax: 'less' },
]
