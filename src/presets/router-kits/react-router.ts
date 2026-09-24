import { DEFAULT_ROUTE_FILES } from '../../data/face-forms.js'
import { defineAdapter, defineFacet } from '../../engine/adapters.js'
import type { RouterAdapter } from '../../engine/types.js'

// 面由**预设**登记（E2）：加一个面不改引擎
defineFacet('router', {
  fields: ['packages', 'routeFiles', 'examples'],
  capabilityRoot: 'router',
})

/**
 * react-router 适配器：库名只许出现在这里（P4 自检拦住别处）。
 *
 * `routeFiles` 是**域的公开面入口**词汇（S03 / S04 / S05 / S14 / S15 照它判）：
 * react-router v7 既写 `routes.tsx`（组件式）也写 `routes.ts`（配置式），
 * 与范式角色表 `modules/{domain}/routes.{ts,tsx}` 是同一份词汇 —— 默认值取自
 * `src/data/face-forms.ts`，不在这里再抄一遍。
 */
export function reactRouterKit(): RouterAdapter {
  return defineAdapter<RouterAdapter>('router', {
    id: 'react-router',
    specVersion: '1',
    packages: ['react-router', 'react-router-dom'],
    routeFiles: [...DEFAULT_ROUTE_FILES],
  })
}
