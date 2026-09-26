import { AdapterError, defineAdapter, defineFacet } from '../engine/adapters.js'
import type { GenericAdapter, Preset } from '../engine/types.js'

/**
 * **失败处理策略**预设：重试 / 退避 / 条件重试**只许出现在声明的落点**（D30）。
 *
 * 场景：`retry: 3` 这个数字 D20 已经管得住（策略数字有家），但**形态它看不见** ——
 * `retry: (count, err) => count < 3 && err.status >= 500` 里的 `3` 在函数体里、
 * `backoff: 'exponential'` 根本不是数字。于是一次后端抖动变成"N 个并发 × 各自的重试"，
 * 而门禁一路绿。
 *
 * 与 D20 的分工（**同一处不会两条都报**）：数字型策略归 D20 的 `numberHomes`，
 * 函数型 / 字符串枚举型归这条。两边都声明了才完整。
 */
defineFacet('error-policy', {
  fields: ['policyIn', 'policyProps', 'examples'],
  capabilityRoot: 'errorPolicy',
})

export interface ErrorPolicyOptions {
  /** 策略的唯一落点（glob 列表）：`['src/shared/api/policy.ts', 'src/modules/<域>/model/query.ts']` */
  policyIn: string[]
  /**
   * 哪些属性名算"失败处理策略"：`['retry','retryDelay','backoff','shouldRetry']`。
   * **可以不写** —— 用数据层 kit 给的名字（react-query 的 `policyProps`），省得把库的事实抄一遍。
   */
  policyProps?: string[]
}

export function errorPolicy(options: ErrorPolicyOptions): Preset {
  const policyIn = options.policyIn ?? []
  if (policyIn.length === 0) {
    throw new AdapterError(
      'errorPolicy() 必须给 policyIn：策略写在哪儿（glob 列表）\n' +
        '（不给落点这条门禁就静默停用 —— 与其这样，不如不写这个预设）',
    )
  }
  if (options.policyProps !== undefined && options.policyProps.length === 0) {
    throw new AdapterError(
      'errorPolicy() 的 policyProps 不能是空数组：空名单等于一个属性名都不判\n' +
        '（想让 kit 给默认名就别写这个字段）',
    )
  }
  return {
    enable: ['D30'],
    adapters: {
      'error-policy': defineAdapter<GenericAdapter>('error-policy', {
        id: 'declared',
        specVersion: '1',
        policyIn: [...policyIn],
        ...(options.policyProps ? { policyProps: [...options.policyProps] } : {}),
      }),
    },
  }
}
