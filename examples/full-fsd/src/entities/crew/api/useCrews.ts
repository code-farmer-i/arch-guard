import { useQuery } from '@tanstack/react-query'
import { fetchCrews, queryStateOf, type QueryState } from '@/shared/api'
import { CREW_PAGE_SIZE, crewKeys } from '../model/query'
import { toCrew } from '../model/mapper'
import type { Crew } from '../model/types'

/** 取数只许出现在切片声明的落点（S36）：实体持有自己的数据，页面只消费 */
export function useCrews(): QueryState<Crew[]> {
  const result = useQuery({
    queryKey: crewKeys.list,
    queryFn: () => fetchCrews(CREW_PAGE_SIZE),
  })
  return queryStateOf(result, toCrew)
}
