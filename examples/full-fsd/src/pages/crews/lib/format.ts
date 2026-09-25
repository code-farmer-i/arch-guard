import dayjs from 'dayjs'

/** 手搓日期格式化会被 P06 报（能力表声明了 dayjs）—— 这里用登记方案 */
export function formatCrewStamp(): string {
  return dayjs().format('YYYY-MM-DD')
}
