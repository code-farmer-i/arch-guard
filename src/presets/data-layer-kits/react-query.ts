import { defineAdapter, defineFacet } from '../../engine/adapters.js'
import type { DataLayerAdapter } from '../../engine/types.js'

defineFacet('data-layer', {
  fields: ['packages', 'queryKeyFrom', 'queryKeyProps', 'examples'],
  capabilityRoot: 'dataLayer',
})

export interface ReactQueryKitOptions {
  /**
   * **缓存键的唯一出处**（如 `src/shared/api/queryKeys.ts`）→ 启用 D22。
   *
   * 落点是**项目决定**（同 `designSystem({ styleDir })`），所以由这里传入而不是 kit 写死；
   * 不传 → D22 明列停用（`requires`），不空转。
   */
  queryKeyFrom?: string
  /** 缓存键挂在哪几个属性上（缺省 `['queryKey']`） */
  queryKeyProps?: string[]
}

/** react-query 适配器：服务端状态的取数与缓存方案 */
export function reactQueryKit(options: ReactQueryKitOptions = {}): DataLayerAdapter {
  return defineAdapter<DataLayerAdapter>('data-layer', {
    id: 'react-query',
    specVersion: '1',
    packages: ['@tanstack/react-query'],
    ...(options.queryKeyFrom ? { queryKeyFrom: options.queryKeyFrom } : {}),
    ...(options.queryKeyProps ? { queryKeyProps: [...options.queryKeyProps] } : {}),
  })
}
