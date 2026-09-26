import { useQuery } from '@tanstack/react-query'
import { requestJson } from '@/shared/api/client'
import { ENDPOINTS } from '@/shared/api/endpoints'
import type { CrewDto } from '@/shared/api/types'
import { queryStateOf, type QueryState } from '@/shared/api/queryState'
import { toCrewRow } from '../lib/mapper'
import { CREW_PAGE_SIZE, crewKeys } from '../model/query'
import type { CrewRow } from '../model/types'

/** 取数只许出现在这里（S36 声明的落点）：页面只消费，不直接打后端 */
export function useCrews(): QueryState<CrewRow[]> {
  const result = useQuery({
    queryKey: crewKeys.list,
    queryFn: async () => {
      // 端点来自唯一出处（D25）、分页来自本域查询契约（R-117）；示例没有真后端 → 空则用一行样例
      const rows = await requestJson<CrewDto>(`${ENDPOINTS.crews}?limit=${CREW_PAGE_SIZE}`)
      return rows.length > 0 ? rows : [{ id: generatedCrewSchema, name: 'crews' }]
    },
  })
  return queryStateOf(result, toCrewRow)
}
