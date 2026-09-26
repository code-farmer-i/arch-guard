import { QueryClient } from '@tanstack/react-query'
import { requestPolicy } from './policy'

/**
 * 全局单例的唯一落点（S38 callSites）+ 全局兜底策略（D20 的家之一）。
 * 各实体自己的时效策略跟着实体走（`entities/<实体>/model/query.ts`）。
 */
export const queryClient = new QueryClient({
  defaultOptions: { queries: {
      ...requestPolicy, staleTime: 300_000, retry: 2 } },
})
