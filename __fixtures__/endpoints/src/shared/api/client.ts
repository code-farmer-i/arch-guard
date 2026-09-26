import { API_BASE_URL } from '@/shared/config/env'
import { ENDPOINTS } from './endpoints'

// 合规：模板里没有路径字面量（来自唯一出处）
export const fetchCrews = (limit: number): Promise<unknown> =>
  fetch(`${API_BASE_URL}${ENDPOINTS.crews}?limit=${limit}`)
