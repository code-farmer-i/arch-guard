import { useQuery } from '@tanstack/react-query'
import { fetchOrders, queryStateOf, type QueryState } from '@/shared/api'
import { ORDER_PAGE_SIZE } from '@/shared/config'
import { toOrder } from '../model/mapper'
import { orderKeys, orderPolicy } from '../model/query'
import type { Order } from '../model/types'

export function useOrders(): QueryState<Order[]> {
  const result = useQuery({
    queryKey: orderKeys.list,
    queryFn: () => fetchOrders(ORDER_PAGE_SIZE),
    ...orderPolicy,
  })
  return queryStateOf(result, toOrder)
}
