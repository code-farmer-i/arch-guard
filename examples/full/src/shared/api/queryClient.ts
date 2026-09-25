import { QueryClient } from '@tanstack/react-query'

/** 全局单例的唯一落点（S38 callSites） */
export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 300_000, retry: 2 } },
})

/** 策略数字的家（D20）：两个域分别取自己的那份，别在调用点重写数字 */
export const crewPolicy = { staleTime: 300_000, retry: 2 }
export const orderPolicy = { staleTime: 60_000, retry: 1 }
