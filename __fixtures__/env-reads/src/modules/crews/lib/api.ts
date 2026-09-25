// 违规：模块里直接读环境
import { format } from '@/shared/lib/format'

export const endpoint = (): string => format(`${import.meta.env.VITE_API_BASE}/crews`)
