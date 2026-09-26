import { RETRY_LIMIT, requestPolicy } from '@/shared/api/policy'

export const crewsQuery = (): unknown =>
  useQuery({
    queryKey: ['crews'],
    ...requestPolicy,
    // 违规：函数型策略写在调用实参里（函数体里的口径别人看不见）
    retry: (count: number) => count < 5,
    // 违规：枚举型策略
    backoff: 'linear',
    // 不报：数字型（那是 D20 numberHomes 的活）
    retryCount: RETRY_LIMIT,
    // 不报：引用而不是字面量
    retryDelay: RETRY_LIMIT,
  })

/**
 * 边界：同名的属性**不在调用实参里**（UI 回调、文案表都长这样）→ 不报。
 * 这条边界是被真实假阳性逼出来的：`retry` 这个名字在示例里撞了两处
 * （`queryState.ts` 的 UI 回调、i18n 的 `retry: '重试'`）。
 */
export const localState = {
  retry: () => undefined,
  backoff: 'linear',
}
