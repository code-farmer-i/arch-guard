import { useQuery } from '@tanstack/react-query'
import { INVOICE_PAGE_SIZE } from '@/shared/config/constants'
import { invoiceKeys } from '@/shared/api/queryKeys'
import { fetchInvoices, invoicePolicy } from '@/shared/api/client'
import type { InvoiceRow } from '../model/types'

export function useInvoices(period: string): InvoiceRow[] {
  const { data } = useQuery({
    queryKey: invoiceKeys.list(period),
    queryFn: () => fetchInvoices(INVOICE_PAGE_SIZE),
    ...invoicePolicy,
  })
  return data ?? []
}
