import { defineAdapter, defineFacet } from '../../engine/adapters.js'
import type { RouterAdapter } from '../../engine/types.js'

// 面由**预设**登记（E2）：加一个面不改引擎
defineFacet('router', {
  fields: ['packages', 'examples'],
  capabilityRoot: 'router',
})

/** react-router 适配器：库名只许出现在这里（P4 自检拦住别处） */
export function reactRouterKit(): RouterAdapter {
  return defineAdapter<RouterAdapter>('router', {
    id: 'react-router',
    specVersion: '1',
    packages: ['react-router', 'react-router-dom'],
  })
}
