import { useQuery } from '@tanstack/react-query'
import { fetchCrews } from '@/shared/api/client'
import { queryStateOf, type QueryState } from '@/shared/api/queryState'
import { PAGE_SIZE } from '@/shared/config/constants'
import { toCrewRow } from '../lib/mapper'
import { crewKeys } from '../model/query'
import type { CrewRow } from '../model/types'

/** 取数只许出现在这里（S36 声明的落点）：页面只消费，不直接打后端 */
export function useCrews(): QueryState<CrewRow[]> {
  const result = useQuery({
    queryKey: crewKeys.list,
    queryFn: () => fetchCrews(PAGE_SIZE),
  })
  return queryStateOf(result, toCrewRow)
}
