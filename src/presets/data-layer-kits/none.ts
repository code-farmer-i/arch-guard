import { defineAdapter, defineFacet } from '../../engine/adapters.js'
import type { DataLayerAdapter } from '../../engine/types.js'

defineFacet('data-layer', {
  fields: ['packages', 'queryKeyFrom', 'queryKeyProps', 'examples'],
  capabilityRoot: 'dataLayer',
})

/** 不用查询库（自己封装 fetch / 服务端取数） */
export function noneDataLayerKit(): DataLayerAdapter {
  return defineAdapter<DataLayerAdapter>('data-layer', {
    id: 'none',
    specVersion: '1',
    packages: [],
  })
}
