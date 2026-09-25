import { API_BASE_URL } from '@/shared/config/env'
import { generatedCrewSchema } from './generated/crews.gen'

export interface CrewDto {
  id: string
  name: string
}

export interface OrderDto {
  id: string
  total: number
}

export async function fetchCrews(limit: number): Promise<CrewDto[]> {
  const response = await fetch(`${API_BASE_URL}/crews?limit=${limit}`)
  if (!response.ok) return []
  return [{ id: generatedCrewSchema, name: 'crews' }]
}

export async function fetchOrders(limit: number): Promise<OrderDto[]> {
  const response = await fetch(`${API_BASE_URL}/orders?limit=${limit}`)
  if (!response.ok) return []
  return [{ id: 'orders', total: limit }]
}
