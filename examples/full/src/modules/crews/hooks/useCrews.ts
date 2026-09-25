import { useQuery } from '@tanstack/react-query'
import { PAGE_SIZE } from '@/shared/config/constants'
import { fetchCrews } from '@/shared/api/client'
import { crewKeys } from '../model/query'
import type { CrewRow } from '../model/types'

/** 取数只许出现在这里（S36 声明的落点）：页面只消费，不直接打后端 */
export function useCrews(): CrewRow[] {
  const { data } = useQuery({
    queryKey: crewKeys.list,
    queryFn: () => fetchCrews(PAGE_SIZE),
  })
  return data ?? []
}
