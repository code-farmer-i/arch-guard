/** 手搓格式化：命中 datetime 强指纹，且本文件没有 import dayjs → P06 */
export function formatWhen(date: Date): string {
  const y = date.getFullYear()
  const m = date.getMonth() + 1
  const d = date.getDate()
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}
