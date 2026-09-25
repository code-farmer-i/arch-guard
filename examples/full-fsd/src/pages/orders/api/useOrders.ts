import { useQuery } from '@tanstack/react-query'
import { fetchOrders, orderKeys, orderPolicy } from '@/shared/api'
import { ORDER_PAGE_SIZE } from '@/shared/config'

export function useOrders(): number[] {
  const { data } = useQuery({
    queryKey: orderKeys.list,
    queryFn: () => fetchOrders(ORDER_PAGE_SIZE),
    ...orderPolicy,
  })
  return (data ?? []).map((item) => item.total)
}
