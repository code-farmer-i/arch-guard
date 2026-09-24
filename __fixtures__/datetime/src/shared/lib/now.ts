// **边界探针**：原生原语与时间戳读写都不算"手搓库"，一条指纹都不该命中
// （expect.json 是 exact，多报即红）
export const now = (): Date => new Date()

export const stamp = (): number => Date.now()

export const fromMs = (value: number): Date => new Date(value)

// `getTime` / `setTime`：刻意**不在**族模式里（取时间戳是合法原生用法，dayjs 未必替得掉）；
// 只有"与 4 位以上数字手算"才报
export const ms = (d: Date): number => d.getTime()

export function setMs(d: Date, value: number): Date {
  const next = new Date(d)
  next.setTime(value)
  return next
}
