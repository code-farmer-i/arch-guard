import { useQuery } from '@tanstack/react-query'
import { requestJson } from '@/shared/api/client'
import { ENDPOINTS } from '@/shared/api/endpoints'
import type { CustomerDto } from '@/shared/api/types'
import { queryStateOf, type QueryState } from '@/shared/api/queryState'
import { toCustomerRow } from '../lib/mapper'
import { CUSTOMER_PAGE_SIZE, customerKeys, customerPolicy } from '../model/query'
import type { CustomerRow } from '../model/types'

export function useCustomers(keywords: string): QueryState<CustomerRow[]> {
  const result = useQuery({
    queryKey: customerKeys.list(keywords),
    queryFn: async () => {
      // 端点来自唯一出处（D25）、分页来自本域查询契约（R-117）；示例没有真后端 → 空则用一行样例
      const rows = await requestJson<CustomerDto>(`${ENDPOINTS.customers}?limit=${CUSTOMER_PAGE_SIZE}`)
      return rows.length > 0 ? rows : [{ id: 'customers', name: 'customers' }]
    },
    ...customerPolicy,
  })
  return queryStateOf(result, toCustomerRow)
}
