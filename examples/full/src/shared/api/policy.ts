/** 失败处理策略的唯一落点（D30）：函数型 / 枚举型策略都只许写在这里 */
export const RETRY_LIMIT = 3

export const requestPolicy = {
  /** 条件重试：只重试 5xx，且最多 3 次 —— 写在函数体里的口径，写在别处没人看得见 */
  retry: (count: number, error: { status: number }): boolean =>
    count < RETRY_LIMIT && error.status >= 500,
  /** 指数退避，封顶 30s */
  retryDelay: (attempt: number): number => Math.min(1000 * 2 ** attempt, 30_000),
  backoff: 'exponential',
}
