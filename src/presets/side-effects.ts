import { AdapterError, defineAdapter, defineFacet } from '../engine/adapters.js'
import type { GenericAdapter, Preset } from '../engine/types.js'

/**
 * **副作用落点**预设：埋点 / 上报 SDK 与本地存储读写只许出现在声明的落点。
 *
 * 场景：`gtag()` / `Sentry.captureException()` / `localStorage.getItem('token')` 直接散在各域 ——
 * "用户没同意隐私协议就别上报"这条逻辑没地方统一；后来要给 token 加密、要加版本迁移、要换 SDK，
 * 就得全仓找。声明落点后，落点外的调用一律报。
 *
 * 为什么做成"预设直接收数据"而不是一套 kit：这两组 API **全是项目决定的**
 * （用哪个埋点 SDK、存储封装叫什么），没有"某个库的方案"可以内置 —— 同 `deps({ allow })` 的形态。
 */
defineFacet('side-effects', {
  fields: ['apis', 'in', 'examples'],
  capabilityRoot: 'sideEffects',
})

export interface SideEffectsOptions {
  /** 哪些调用算副作用：`['localStorage','sessionStorage','gtag','Sentry.captureException']` */
  apis: string[]
  /** 只许出现在哪些落点（glob 列表）：`['src/shared/lib/storage.ts','src/shared/lib/analytics.ts']` */
  in: string[]
}

export function sideEffects(options: SideEffectsOptions): Preset {
  const apis = options.apis ?? []
  const allowed = options.in ?? []
  // 声明了预设却什么都没收 = 静默失能（规则会因能力不足而停用，但配置看起来"配了"）→ fail-closed
  if (apis.length === 0 || allowed.length === 0) {
    throw new AdapterError(
      'sideEffects() 需要同时给 apis 与 in：前者是"哪些调用算副作用"，后者是"只许出现在哪些落点"\n' +
        '（空清单会让这条门禁静默停用 —— 与其这样，不如不写这个预设）',
    )
  }
  return {
    enable: ['S38'],
    adapters: {
      'side-effects': defineAdapter<GenericAdapter>('side-effects', {
        id: 'declared',
        specVersion: '1',
        apis: [...apis],
        in: [...allowed],
      }),
    },
  }
}
