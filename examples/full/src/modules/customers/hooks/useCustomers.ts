import { useQuery } from '@tanstack/react-query'
import { CUSTOMER_PAGE_SIZE } from '@/shared/config/constants'
import { customerKeys } from '@/shared/api/queryKeys'
import { customerPolicy, fetchCustomers } from '@/shared/api/client'
import type { CustomerRow } from '../model/types'

export function useCustomers(keywords: string): CustomerRow[] {
  const { data } = useQuery({
    queryKey: customerKeys.list(keywords),
    queryFn: () => fetchCustomers(CUSTOMER_PAGE_SIZE),
    ...customerPolicy,
  })
  return data ?? []
}
