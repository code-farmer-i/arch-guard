import { crewsKeys } from '@/shared/api/queryKeys'

// 合规：取数就在声明的落点里（域内 hooks/）
export function useCrews() {
  return useQuery({ queryKey: crewsKeys.list, queryFn: loadCrews })
}
