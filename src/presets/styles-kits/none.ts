import { defineAdapter, defineFacet } from '../../engine/adapters.js'
import type { StylesAdapter } from '../../engine/types.js'

defineFacet('styles', {
  fields: ['packages', 'modulePattern', 'examples'],
  capabilityRoot: 'styles',
})

/** 不声明样式方案（样式由 designSystem() 管；这里只是让 P12 的这类不被猜） */
export function noneStylesKit(): StylesAdapter {
  return defineAdapter<StylesAdapter>('styles', { id: 'none', specVersion: '1', packages: [] })
}
