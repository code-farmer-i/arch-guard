// 字符串日期解析：`Date.parse` 与 `new Date('…')` 字面量 —— 登记了 datetime 能力就该走 dayjs
export const EPOCH = new Date('2024-01-01')

export function parseMs(value: string): number {
  return Date.parse(value)
}
