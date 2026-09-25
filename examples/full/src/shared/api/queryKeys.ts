/** 缓存键的唯一出处（D22）：调用点只许引用这里 */
export const crewKeys = {
  list: ['crews'] as const,
  detail: (id: string) => ['crews', id] as const,
}

export const orderKeys = {
  list: ['orders'] as const,
}

export const customerKeys = {
  list: (keywords: string) => ['customers', keywords] as const,
}

export const invoiceKeys = {
  list: (period: string) => ['invoices', period] as const,
}
