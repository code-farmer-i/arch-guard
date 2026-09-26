import type { CustomerDto } from '@/shared/api/types'
import type { CustomerRow } from '../model/types'

export function toCustomerRow(dto: CustomerDto): CustomerRow {
  return { id: dto.id, name: dto.name }
}
