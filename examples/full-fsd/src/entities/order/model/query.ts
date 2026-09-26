/** 这个实体的查询契约：缓存键 + 请求策略 */
export const orderKeys = {
  list: ['orders'] as const,
}

export const orderPolicy = { staleTime: 60_000, retry: 1 }

/**
 * 分页大小：**这个实体自己的 UX 决定**（R-117）—— 与键、策略同处，不放进 shared。
 */
export const ORDER_PAGE_SIZE = 50
