import { useQuery } from '@tanstack/react-query'
import { requestJson } from '@/shared/api/client'
import { ENDPOINTS } from '@/shared/api/endpoints'
import type { InvoiceDto } from '@/shared/api/types'
import { queryStateOf, type QueryState } from '@/shared/api/queryState'
import { toInvoiceRow } from '../lib/mapper'
import { INVOICE_PAGE_SIZE, invoiceKeys, invoicePolicy } from '../model/query'
import type { InvoiceRow } from '../model/types'

export function useInvoices(period: string): QueryState<InvoiceRow[]> {
  const result = useQuery({
    queryKey: invoiceKeys.list(period),
    queryFn: async () => {
      // 端点来自唯一出处（D25）、分页来自本域查询契约（R-117）；示例没有真后端 → 空则用一行样例
      const rows = await requestJson<InvoiceDto>(`${ENDPOINTS.invoices}?limit=${INVOICE_PAGE_SIZE}`)
      return rows.length > 0 ? rows : [{ id: 'invoices', amount: INVOICE_PAGE_SIZE, crew: generatedCrewSchema }]
    },
    ...invoicePolicy,
  })
  return queryStateOf(result, toInvoiceRow)
}
