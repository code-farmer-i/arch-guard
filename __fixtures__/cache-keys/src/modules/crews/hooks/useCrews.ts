import { crewsKeys } from '@/shared/api/queryKeys'

export function useCrews(id: string) {
  // 违规：手拼缓存键（D22）
  useQuery({ queryKey: ['crews', id], queryFn: loadCrews })

  // 合规：键来自唯一出处
  return useQuery({ queryKey: crewsKeys.detail(id), queryFn: loadCrews })
}
