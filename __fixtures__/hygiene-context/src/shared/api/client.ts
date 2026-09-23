// H08 反例：业务代码里写死地址
export const API_BASE = 'https://api.example.com'
export const DEV_BASE = 'http://localhost:8080'

export function apiBase(): string {
  return API_BASE
}
