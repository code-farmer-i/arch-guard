import dayjs from 'dayjs'

export function stamp(value: Date): string {
  return dayjs(value).format('YYYY-MM-DD HH:mm')
}
