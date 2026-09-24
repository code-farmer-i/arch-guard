// 合规写法：用平台内置，**一条指纹都不该命中**
export const clone = <T>(x: T): T => structuredClone(x)

export const id = (): string => crypto.randomUUID()

export const money = (n: number): string =>
  new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(n)

export const same = (a: unknown, b: unknown): boolean => isDeepStrictEqual(a, b)

export const query = (parts: Record<string, string>): string => new URLSearchParams(parts).toString()
