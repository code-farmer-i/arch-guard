import { useQuery } from '@tanstack/react-query'
import { ENDPOINTS, requestJson, queryStateOf, type OrderDto, type QueryState } from '@/shared/api'
import { ORDER_PAGE_SIZE, orderKeys, orderPolicy } from '../model/query'
import { toOrder } from '../model/mapper'
import type { Order } from '../model/types'

export function useOrders(): QueryState<Order[]> {
  const result = useQuery({
    queryKey: orderKeys.list,
    queryFn: async () => {
      const rows = await requestJson<OrderDto>(`${ENDPOINTS.orders}?limit=${ORDER_PAGE_SIZE}`)
      return rows.length > 0 ? rows : [{ id: 'orders', total: ORDER_PAGE_SIZE, crew: 'crews' }]
    },
    ...orderPolicy,
  })
  return queryStateOf(result, toOrder)
}
