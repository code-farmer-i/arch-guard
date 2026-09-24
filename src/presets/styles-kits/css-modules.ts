import { defineAdapter, defineFacet } from '../../engine/adapters.js'
import type { StylesAdapter } from '../../engine/types.js'

defineFacet('styles', {
  fields: ['packages', 'modulePattern', 'examples'],
  capabilityRoot: 'styles',
})

/** CSS Module 适配器：没有 npm 包，只有文件名形态 */
export function cssModulesKit(): StylesAdapter {
  return defineAdapter<StylesAdapter>('styles', {
    id: 'css-modules',
    specVersion: '1',
    packages: [],
    modulePattern: '\\.module\\.css$',
    examples: {
      modulePattern: { hit: ['x.module.css'], miss: ['x.css', 'x.module.ts'] },
    },
  })
}
