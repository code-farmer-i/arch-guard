import { API_BASE_URL } from '@/shared/config'
import { generatedCrewSchema } from './generated/crews.gen'
import type { CrewDto, OrderDto } from './types'

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
