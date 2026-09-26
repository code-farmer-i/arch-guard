import type { OrderDto } from '@/shared/api'
import type { Order } from './types'

/** 显式的 DTO → 领域实体映射：后端字段改名/改含义时**这里会报类型错**，而不是静默丢字段 */
export function toOrder(dto: OrderDto): Order {
  return { id: dto.id, total: dto.total, crewId: dto.crew }
}
