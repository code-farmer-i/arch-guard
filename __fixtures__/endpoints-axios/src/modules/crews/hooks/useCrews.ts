import axios from 'axios'
import { ENDPOINTS } from '../../../shared/api/endpoints'

const API = 'https://api.example.com'

// 合规：端点来自唯一出处（axios.get 走的是声明的落点）
export const fetchCrews = (): Promise<unknown> => axios.get(`${API}${ENDPOINTS.crews}?limit=1`)
