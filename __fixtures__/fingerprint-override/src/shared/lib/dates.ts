// 违规：手搓日期格式化（datetime 的强指纹），该走 dayjs
export function label(date: Date): string {
  return date.toLocaleDateString()
}
