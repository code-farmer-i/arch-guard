// 合规：dayjs 已声明；node: 内置不算依赖
import dayjs from 'dayjs'
import { readFileSync } from 'node:fs'

export const stamp = (): string => dayjs().format('YYYY-MM-DD') + String(readFileSync)
