/** 这个域的查询契约：缓存键 + 请求策略 */
export const customerKeys = {
  list: (keywords: string) => ['customers', keywords] as const,
}

export const customerPolicy = { staleTime: 120_000, retry: 1 }
