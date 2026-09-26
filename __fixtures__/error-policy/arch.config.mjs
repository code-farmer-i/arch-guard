import { canonical, errorPolicy } from '../../es/index.js'

/**
 * 失败处理的策略只有一个出处（R-111 / D30）。
 *
 * - 家里（`src/shared/api/policy.ts`）写函数型 / 枚举型策略 → 合规
 * - 家外写 `retry: (count) => count < 5`（函数型）· `backoff: 'linear'`（枚举型）→ 报
 * - `retryCount: 3`（数字型）→ **不报**（那是 D20 `numberHomes` 的活，同一处不该两条都报）
 * - `retryDelay: RETRY_DELAY_MS`（引用）→ 不报
 * - `useCrews.test.ts` 里的同形态 → 不报（测试文件放行）
 * - **同名属性不在调用实参里**（UI 回调 / 文案表）→ 不报（这条边界是被真实假阳性逼出来的）
 */
export default {
  presets: [
    canonical(),
    // 这个夹具没装 data-layer kit，所以策略名要自己列（装了 react-query kit 就由 `policyProps` 给）
    errorPolicy({
      policyIn: ['src/shared/api/policy.ts'],
      policyProps: ['retry', 'retryDelay', 'backoff', 'shouldRetry'],
    }),
  ],
  overrides: { enable: ['D30'], ignore: ['arch.config.mjs', 'expect.json'] },
}
