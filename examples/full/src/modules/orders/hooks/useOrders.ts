import { useQuery } from '@tanstack/react-query'
import { ORDER_PAGE_SIZE } from '@/shared/config/constants'
import { fetchOrders } from '@/shared/api/client'
import { orderKeys, orderPolicy } from '../model/query'
import type { OrderRow } from '../model/types'

export function useOrders(): OrderRow[] {
  const { data } = useQuery({
    queryKey: orderKeys.list,
    queryFn: () => fetchOrders(ORDER_PAGE_SIZE),
    ...orderPolicy,
  })
  return data ?? []
}
