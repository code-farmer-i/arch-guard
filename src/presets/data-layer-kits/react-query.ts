import { defineAdapter, defineFacet } from '../../engine/adapters.js'
import type { DataLayerAdapter } from '../../engine/types.js'

defineFacet('data-layer', {
  fields: ['packages', 'queryKeyFrom', 'examples'],
  capabilityRoot: 'dataLayer',
})

/** react-query 适配器：服务端状态的取数与缓存方案 */
export function reactQueryKit(): DataLayerAdapter {
  return defineAdapter<DataLayerAdapter>('data-layer', {
    id: 'react-query',
    specVersion: '1',
    packages: ['@tanstack/react-query'],
    // 缓存键的唯一出处属于**项目**（范式决定 shared/api/queryKeys.ts），这里只给默认形态
    queryKeyFrom: 'queryKeys.ts',
  })
}
