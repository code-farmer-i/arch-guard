import { FACET_FIELDS } from '../../data/face-forms.js'
import { DEFAULT_ROUTE_FILES } from '../../data/face-forms.js'
import { defineAdapter, defineFacet } from '../../engine/adapters.js'
import type { RouterAdapter } from '../../engine/types.js'

defineFacet('router', {
  fields: [...FACET_FIELDS.router],
  capabilityRoot: 'router',
})

export interface NoneRouterKitOptions {
  /**
   * 域的**公开面入口**文件名。缺省 `routes.ts` / `routes.tsx`；声明 `[]` = **没有 per-domain 出口文件**。
   *
   * 什么时候声明 `[]`：路由由框架的目录约定产生（Next / Remix / Nuxt 那类文件路由）——
   * 那时 S04 / S05 / S14 / S15 的入口相关判定**不判**（没有判据），S03 仍盯着域根散件。
   * 注意这只改"入口文件"这一类判定；域结构本身仍按所选范式的角色表判（见 DESIGN §7.2(4)）。
   */
  routeFiles?: string[]
}

/**
 * 不用客户端路由（多页 / 服务端渲染）：显式声明，别让 P12 靠猜。
 *
 * `routeFiles` **默认照常**（不是空）：没有路由**库**不等于没有域的路由**出口** ——
 * 三根范式仍靠 `modules/<域>/routes.{ts,tsx}` 声明这个域对外暴露什么。
 * 只有"路由由目录约定产生"的文件路由才传 `{ routeFiles: [] }`。
 */
export function noneRouterKit(options: NoneRouterKitOptions = {}): RouterAdapter {
  return defineAdapter<RouterAdapter>('router', {
    id: 'none',
    specVersion: '1',
    packages: [],
    routeFiles: [...(options.routeFiles ?? DEFAULT_ROUTE_FILES)],
  })
}
