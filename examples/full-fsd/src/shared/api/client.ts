import { API_BASE_URL } from '@/shared/config'

/**
 * **传输层**（S38 声明的落点）：基址 / 鉴权 / 错误处理只在这里做。
 *
 * 各域的**取数函数**在各自的 hooks 里 —— 只有那个域知道自己的端点、分页大小与映射（R-119）。
 * 放在共享层的话，加 / 下线一个域都要改这个文件（判据见 PARADIGM §6.15）。
 */
export async function requestJson<T>(path: string): Promise<T[]> {
  const response = await fetch(`${API_BASE_URL}${path}`)
  if (!response.ok) return []
  return (await response.json()) as T[]
}
