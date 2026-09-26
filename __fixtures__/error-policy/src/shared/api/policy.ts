/** 失败处理策略的唯一落点（D30）：函数型 / 枚举型策略都只许写在这里 */
export const RETRY_LIMIT = 3

export const requestPolicy = {
  retry: (count: number, err: { status: number }): boolean => count < RETRY_LIMIT && err.status >= 500,
  retryDelay: (attempt: number): number => Math.min(1000 * 2 ** attempt, 30_000),
  backoff: 'exponential',
}
