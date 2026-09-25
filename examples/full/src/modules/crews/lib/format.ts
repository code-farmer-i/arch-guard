import dayjs from 'dayjs'

export function formatCrewName(name: string): string {
  return `${name} · ${dayjs().format('YYYY-MM-DD')}`
}
