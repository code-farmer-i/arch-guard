import type { OrderDto } from '@/shared/api'
import type { Order } from './types'

export function toOrder(dto: OrderDto): Order {
  return { id: dto.id, total: dto.total }
}
