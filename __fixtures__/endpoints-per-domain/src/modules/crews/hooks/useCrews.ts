import { CREW_ENDPOINTS } from '../model/endpoints'

const API = 'https://api.example.com'

// 合规：端点来自本域的表
export const fetchCrews = (): Promise<unknown> =>
  fetch(`${API}${CREW_ENDPOINTS.crews}?limit=1`)
