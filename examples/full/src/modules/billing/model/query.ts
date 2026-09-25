/** 这个域的查询契约：缓存键 + 请求策略 */
export const invoiceKeys = {
  list: (period: string) => ['invoices', period] as const,
}

export const invoicePolicy = { staleTime: 30_000, retry: 3 }
