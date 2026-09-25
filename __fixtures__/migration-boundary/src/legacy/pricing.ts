// 迁移中：它可以引用新代码（只出不进）
import { format } from '@/shared/lib/format'

export const oldPrice = (value: number): string => format(String(value))
