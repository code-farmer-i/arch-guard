import { useQuery } from '@tanstack/react-query'
import { requestJson } from '@/shared/api/client'
import { ENDPOINTS } from '@/shared/api/endpoints'
import type { OrderDto } from '@/shared/api/types'
import { queryStateOf, type QueryState } from '@/shared/api/queryState'
import { toOrderRow } from '../lib/mapper'
import { ORDER_PAGE_SIZE, orderKeys, orderPolicy } from '../model/query'
import type { OrderRow } from '../model/types'

export function useOrders(): QueryState<OrderRow[]> {
  const result = useQuery({
    queryKey: orderKeys.list,
    queryFn: async () => {
      // 端点来自唯一出处（D25）、分页来自本域查询契约（R-117）；示例没有真后端 → 空则用一行样例
      const rows = await requestJson<OrderDto>(`${ENDPOINTS.orders}?limit=${ORDER_PAGE_SIZE}`)
      return rows.length > 0 ? rows : [{ id: 'orders', total: ORDER_PAGE_SIZE }]
    },
    ...orderPolicy,
  })
  return queryStateOf(result, toOrderRow)
}
