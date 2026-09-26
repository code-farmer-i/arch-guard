import { AdapterError, defineAdapter, defineFacet } from '../engine/adapters.js'
import type { GenericAdapter, Preset } from '../engine/types.js'

/**
 * **埋点**预设：事件名只许出现在声明的**唯一出处**（D24）。
 *
 * 场景：`track('crews_view')` 的事件名在各处手拼 —— 改名漏一处就是**数据断层**，
 * 而分析平台不会报错（它只会安静地少收一个事件）。与缓存键（D22）/ 路由路径（D23）同族。
 */
defineFacet('analytics', {
  fields: ['apis', 'eventSource', 'examples'],
  capabilityRoot: 'analytics',
})

export interface AnalyticsOptions {
  /** 埋点调用名：`['track', 'gtag', 'Sentry.captureMessage']` */
  apis: string[]
  /** 事件名的唯一出处（文件路径）：`src/shared/lib/analytics/events.ts` */
  eventSource: string
}

export function analytics(options: AnalyticsOptions): Preset {
  const apis = options.apis ?? []
  if (apis.length === 0 || !options.eventSource) {
    throw new AdapterError(
      'analytics() 需要同时给 apis 与 eventSource：前者是"哪些调用算埋点"，后者是"事件名写在哪\n' +
        '（缺一个这条门禁就静默停用 —— 与其这样，不如不写这个预设）',
    )
  }
  return {
    // S46（上报不许写在渲染体里）也用 `analytics.apis` 这个受体 —— 装了面就一并启用
    enable: ['D24', 'S46'],
    adapters: {
      analytics: defineAdapter<GenericAdapter>('analytics', {
        id: 'declared',
        specVersion: '1',
        apis: [...apis],
        eventSource: options.eventSource,
      }),
    },
  }
}
