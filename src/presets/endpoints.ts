import { AdapterError, defineAdapter, defineFacet } from '../engine/adapters.js'
import type { GenericAdapter, Preset } from '../engine/types.js'

/**
 * **后端端点**预设：端点路径只许出现在声明的**唯一出处**（D25）。
 *
 * 场景：`` fetch(`${API_BASE_URL}/crews?limit=${n}`) `` 写在 API 客户端里，另一个文件再拼一次
 * 同一个端点 —— 改接口时漏一处就是 404 / 数据断层。与缓存键（D22）/ 路由路径（D23）/ 事件名（D24）
 * 同一族，唯独端点以前没人管（端点多写在模板串里，事实模型看不见）。
 */
defineFacet('endpoints', {
  fields: ['apis', 'source', 'examples'],
  capabilityRoot: 'endpoints',
})

export interface EndpointsOptions {
  /** 哪些调用算"打后端"：`['fetch', 'axios.get', 'request']` */
  apis: string[]
  /** 端点路径的唯一出处（文件路径）：`src/shared/api/endpoints.ts` */
  source: string
}

export function endpoints(options: EndpointsOptions): Preset {
  const apis = options.apis ?? []
  if (apis.length === 0 || !options.source) {
    throw new AdapterError(
      'endpoints() 需要同时给 apis 与 source：前者是"哪些调用算打后端"，后者是"端点写在哪"\n' +
        '（缺一个这条门禁就静默停用 —— 与其这样，不如不写这个预设）',
    )
  }
  return {
    enable: ['D25'],
    adapters: {
      endpoints: defineAdapter<GenericAdapter>('endpoints', {
        id: 'declared',
        specVersion: '1',
        apis: [...apis],
        source: options.source,
      }),
    },
  }
}
