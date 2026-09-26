import type { OrderDto } from '@/shared/api/types'
import type { OrderRow } from '../model/types'

export function toOrderRow(dto: OrderDto): OrderRow {
  return { id: dto.id, total: dto.total }
}
