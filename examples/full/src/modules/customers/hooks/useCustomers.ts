import { useQuery } from '@tanstack/react-query'
import { fetchCustomers } from '@/shared/api/client'
import { queryStateOf, type QueryState } from '@/shared/api/queryState'
import { toCustomerRow } from '../lib/mapper'
import { CUSTOMER_PAGE_SIZE, customerKeys, customerPolicy } from '../model/query'
import type { CustomerRow } from '../model/types'

export function useCustomers(keywords: string): QueryState<CustomerRow[]> {
  const result = useQuery({
    queryKey: customerKeys.list(keywords),
    queryFn: () => fetchCustomers(CUSTOMER_PAGE_SIZE),
    ...customerPolicy,
  })
  return queryStateOf(result, toCustomerRow)
}
