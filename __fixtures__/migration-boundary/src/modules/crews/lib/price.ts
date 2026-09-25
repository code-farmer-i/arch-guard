// 违规：新代码反向依赖了迁移中的旧实现
import { oldPrice } from '@/legacy/pricing'

export const price = (value: number): string => oldPrice(value)
