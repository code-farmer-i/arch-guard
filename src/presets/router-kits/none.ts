import { defineAdapter, defineFacet } from '../../engine/adapters.js'
import type { RouterAdapter } from '../../engine/types.js'

defineFacet('router', {
  fields: ['packages', 'routerLink', 'routeFile', 'examples'],
  capabilityRoot: 'router',
})

/** 不用客户端路由（多页 / 框架文件路由）：显式声明，别让 P12 靠猜 */
export function noneRouterKit(): RouterAdapter {
  return defineAdapter<RouterAdapter>('router', { id: 'none', specVersion: '1', packages: [] })
}
