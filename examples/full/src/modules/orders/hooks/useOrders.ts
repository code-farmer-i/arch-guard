import { useQuery } from '@tanstack/react-query'
import { ORDER_PAGE_SIZE } from '@/shared/config/constants'
import { orderKeys } from '@/shared/api/queryKeys'
import { fetchOrders, orderPolicy } from '@/shared/api/client'
import type { OrderRow } from '../model/types'

export function useOrders(): OrderRow[] {
  const { data } = useQuery({
    queryKey: orderKeys.list,
    queryFn: () => fetchOrders(ORDER_PAGE_SIZE),
    ...orderPolicy,
  })
  return data ?? []
}
