import { useQuery } from '@tanstack/react-query'
import { fetchInvoices } from '@/shared/api/client'
import { queryStateOf, type QueryState } from '@/shared/api/queryState'
import { INVOICE_PAGE_SIZE } from '@/shared/config/constants'
import { toInvoiceRow } from '../lib/mapper'
import { invoiceKeys, invoicePolicy } from '../model/query'
import type { InvoiceRow } from '../model/types'

export function useInvoices(period: string): QueryState<InvoiceRow[]> {
  const result = useQuery({
    queryKey: invoiceKeys.list(period),
    queryFn: () => fetchInvoices(INVOICE_PAGE_SIZE),
    ...invoicePolicy,
  })
  return queryStateOf(result, toInvoiceRow)
}
