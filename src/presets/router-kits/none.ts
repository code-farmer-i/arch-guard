import { DEFAULT_ROUTE_FILES } from '../../data/face-forms.js'
import { defineAdapter, defineFacet } from '../../engine/adapters.js'
import type { RouterAdapter } from '../../engine/types.js'

defineFacet('router', {
  fields: ['packages', 'routeFiles', 'examples'],
  capabilityRoot: 'router',
})

/**
 * 不用客户端路由（多页 / 服务端渲染）：显式声明，别让 P12 靠猜。
 *
 * `routeFiles` **照默认**（不是空）：没有路由**库**不等于没有域的路由**出口** ——
 * 三根范式仍靠 `modules/<域>/routes.{ts,tsx}` 声明这个域对外暴露什么。
 * 只有"路由由目录约定产生"的文件路由元框架才声明 `[]`（那种形态下确实没有 per-domain 出口）。
 */
export function noneRouterKit(): RouterAdapter {
  return defineAdapter<RouterAdapter>('router', {
    id: 'none',
    specVersion: '1',
    packages: [],
    routeFiles: [...DEFAULT_ROUTE_FILES],
  })
}
