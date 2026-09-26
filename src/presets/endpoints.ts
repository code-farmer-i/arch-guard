import { AdapterError, defineAdapter, defineFacet } from '../engine/adapters.js'
import { CALL_SITE_SOURCE_IDS } from '../data/call-site-sources.js'
import type { GenericAdapter, Preset } from '../engine/types.js'

/**
 * **后端端点**预设：端点路径只许出现在声明的**唯一出处**（D25）。
 *
 * 场景：`` fetch(`${API_BASE_URL}/crews?limit=${n}`) `` 写在 API 客户端里，另一个文件再拼一次
 * 同一个端点 —— 改接口时漏一处就是 404 / 数据断层。与缓存键（D22）/ 路由路径（D23）/ 事件名（D24）
 * 同一族，唯独端点以前没人管（端点多写在模板串里，事实模型看不见）。
 */
defineFacet('endpoints', {
  fields: ['apis', 'from', 'source', 'examples'],
  capabilityRoot: 'endpoints',
})

export interface EndpointsOptions {
  /** 哪些调用算"打后端"：`['fetch', 'axios.get', 'request']` */
  apis?: string[]
  /**
   * `apis` 的**来源**：`callSiteSources.platform.network`（值就是来源 id）。
   * 用它而不是手写 —— "哪些调用算网络调用"是**平台/库的事实**，手抄一遍等于把别处的知识再写一次
   * （写错一个字母还会静默少判；这条自述由 R-114 补上）。
   * 与 `apis` 二选一（都给时 `apis` 优先）。
   */
  from?: string
  /** 端点路径的唯一出处（文件路径）：`src/shared/api/endpoints.ts` */
  source: string
}

export function endpoints(options: EndpointsOptions): Preset {
  const apis = options.apis ?? []
  if (apis.length === 0 && !options.from) {
    throw new AdapterError(
      'endpoints() 要说明"哪些调用算打后端"：给 `apis`（自列）或 `from`（来源 id，如 ' +
        '`callSiteSources.platform.network`）\n' +
        '（缺了这条门禁就静默停用 —— 与其这样，不如不写这个预设）',
    )
  }
  if (options.from && !CALL_SITE_SOURCE_IDS.includes(options.from)) {
    throw new AdapterError(
      `endpoints() 的来源 ${options.from} 不认识\n（可用：${CALL_SITE_SOURCE_IDS.join(' / ')}）`,
    )
  }
  if (!options.source) {
    throw new AdapterError('endpoints() 需要给 source：端点写在哪（文件路径）')
  }
  return {
    enable: ['D25'],
    adapters: {
      endpoints: defineAdapter<GenericAdapter>('endpoints', {
        id: 'declared',
        specVersion: '1',
        ...(apis.length > 0 ? { apis: [...apis] } : {}),
        ...(options.from ? { from: options.from } : {}),
        source: options.source,
      }),
    },
  }
}
