/** 这个实体的查询契约：缓存键 + 请求策略 */
export const orderKeys = {
  list: ['orders'] as const,
}

export const orderPolicy = { staleTime: 60_000, retry: 1 }
