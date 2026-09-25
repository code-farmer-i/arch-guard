import dayjs from 'dayjs'

export const stamp = (): string => dayjs().format('YYYY-MM-DD')
