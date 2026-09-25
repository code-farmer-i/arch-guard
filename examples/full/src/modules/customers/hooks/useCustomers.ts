import { useQuery } from '@tanstack/react-query'
import { CUSTOMER_PAGE_SIZE } from '@/shared/config/constants'
import { fetchCustomers } from '@/shared/api/client'
import { customerKeys, customerPolicy } from '../model/query'
import type { CustomerRow } from '../model/types'

export function useCustomers(keywords: string): CustomerRow[] {
  const { data } = useQuery({
    queryKey: customerKeys.list(keywords),
    queryFn: () => fetchCustomers(CUSTOMER_PAGE_SIZE),
    ...customerPolicy,
  })
  return data ?? []
}
