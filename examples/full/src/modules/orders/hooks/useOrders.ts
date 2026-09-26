import { useQuery } from '@tanstack/react-query'
import { fetchOrders } from '@/shared/api/client'
import { queryStateOf, type QueryState } from '@/shared/api/queryState'
import { toOrderRow } from '../lib/mapper'
import { ORDER_PAGE_SIZE, orderKeys, orderPolicy } from '../model/query'
import type { OrderRow } from '../model/types'

export function useOrders(): QueryState<OrderRow[]> {
  const result = useQuery({
    queryKey: orderKeys.list,
    queryFn: () => fetchOrders(ORDER_PAGE_SIZE),
    ...orderPolicy,
  })
  return queryStateOf(result, toOrderRow)
}
