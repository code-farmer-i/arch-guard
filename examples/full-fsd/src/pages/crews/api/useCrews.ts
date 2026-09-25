import { useQuery } from '@tanstack/react-query'
import { crewKeys, crewPolicy, fetchCrews } from '@/shared/api'
import { PAGE_SIZE } from '@/shared/config'

/** 取数只许出现在切片声明的落点（S36）：页面只消费 */
export function useCrews(): string[] {
  const { data } = useQuery({
    queryKey: crewKeys.list,
    queryFn: () => fetchCrews(PAGE_SIZE),
    ...crewPolicy,
  })
  return (data ?? []).map((item) => item.name)
}
