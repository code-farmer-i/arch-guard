import { DEFAULT_MODULE_PATTERNS } from '../../data/face-forms.js'
import { defineAdapter, defineFacet } from '../../engine/adapters.js'
import type { StylesAdapter } from '../../engine/types.js'

defineFacet('styles', {
  fields: ['packages', 'modulePatterns', 'examples'],
  capabilityRoot: 'styles',
})

/**
 * 不声明样式方案（样式由 designSystem() 管；这里只是让 P12 的这类不被猜）。
 *
 * `modulePatterns` **照默认**（不是空）："没选样式库"不等于"没有组件样式文件" ——
 * CSS Module 是零依赖方案，三根范式的默认形态就是它。
 * 声明 `[]` 的是 Tailwind / CSS-in-JS 这类**确实没有组件样式文件**的方案（那时 D16 / D17 不判）。
 */
export function noneStylesKit(): StylesAdapter {
  return defineAdapter<StylesAdapter>('styles', {
    id: 'none',
    specVersion: '1',
    packages: [],
    modulePatterns: [...DEFAULT_MODULE_PATTERNS],
  })
}
