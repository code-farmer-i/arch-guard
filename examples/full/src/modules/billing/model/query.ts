/** 这个域的查询契约：缓存键 + 请求策略 */
export const invoiceKeys = {
  list: (period: string) => ['invoices', period] as const,
}

export const invoicePolicy = { staleTime: 30_000, retry: 3 }

/**
 * 分页大小：**这个域自己的 UX 决定**（R-117）—— 与键、策略同处，不放进 shared。
 * 判据：本域迭代发起（跟域走）· 加一个域不必改共享文件 · 名空间是局部的。
 */
export const INVOICE_PAGE_SIZE = 25
