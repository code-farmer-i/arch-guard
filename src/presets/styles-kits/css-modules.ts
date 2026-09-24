import { defineAdapter, defineFacet } from '../../engine/adapters.js'
import type { StylesAdapter } from '../../engine/types.js'

defineFacet('styles', {
  fields: ['packages', 'examples'],
  capabilityRoot: 'styles',
})

/**
 * CSS Module 适配器：它是"没有 npm 包"的方案，`packages` 为空 ——
 * 声明它的作用是把 `styles` 面登记成"已选 CSS Module"，从而让 P12 拦住混进来的同类样式库。
 */
export function cssModulesKit(): StylesAdapter {
  return defineAdapter<StylesAdapter>('styles', {
    id: 'css-modules',
    specVersion: '1',
    packages: [],
  })
}
