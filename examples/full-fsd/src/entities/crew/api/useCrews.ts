import { useQuery } from '@tanstack/react-query'
import { ENDPOINTS, requestJson, queryStateOf, type CrewDto, type QueryState } from '@/shared/api'
import { CREW_PAGE_SIZE, crewKeys } from '../model/query'
import { toCrew } from '../model/mapper'
import type { Crew } from '../model/types'

/** 取数只许出现在切片声明的落点（S36）：实体持有自己的数据，页面只消费 */
export function useCrews(): QueryState<Crew[]> {
  const result = useQuery({
    queryKey: crewKeys.list,
    // 端点来自唯一出处（D25）、分页来自本实体查询契约（R-117）；示例没有真后端 → 空则用样例
    queryFn: async () => {
      const rows = await requestJson<CrewDto>(`${ENDPOINTS.crews}?limit=${CREW_PAGE_SIZE}`)
      return rows.length > 0 ? rows : [{ id: 'crews', name: 'crews' }]
    },
  })
  return queryStateOf(result, toCrew)
}
