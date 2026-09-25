import { QueryClient } from '@tanstack/react-query'

/**
 * 全局单例的唯一落点（S38 callSites）+ 全局兜底策略（D20 的家之一）。
 *
 * **各域自己的时效策略不在这里** —— 它们跟着域走（`modules/<域>/model/query.ts`）：
 * 那是每个域的数据知识，放共享层会变成横向 merge 队列。
 */
export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 300_000, retry: 2 } },
})
