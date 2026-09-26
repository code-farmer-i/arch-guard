import type { InvoiceDto } from '@/shared/api/types'
import type { InvoiceRow } from '../model/types'

export function toInvoiceRow(dto: InvoiceDto): InvoiceRow {
  return { id: dto.id, amount: dto.amount, crew: dto.crew }
}
