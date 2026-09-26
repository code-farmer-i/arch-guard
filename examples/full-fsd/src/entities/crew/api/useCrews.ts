import { useQuery } from '@tanstack/react-query'
import { fetchCrews, queryStateOf, type QueryState } from '@/shared/api'
import { PAGE_SIZE } from '@/shared/config'
import { toCrew } from '../model/mapper'
import { crewKeys } from '../model/query'
import type { Crew } from '../model/types'

/** 取数只许出现在切片声明的落点（S36）：实体持有自己的数据，页面只消费 */
export function useCrews(): QueryState<Crew[]> {
  const result = useQuery({
    queryKey: crewKeys.list,
    queryFn: () => fetchCrews(PAGE_SIZE),
  })
  return queryStateOf(result, toCrew)
}
