import { API_BASE_URL } from '@/shared/config/env'
import { generatedCrewSchema } from './generated/crews.gen'
import type { CrewDto, CustomerDto, InvoiceDto, OrderDto } from './types'

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

export async function fetchCustomers(limit: number): Promise<CustomerDto[]> {
  const response = await fetch(`${API_BASE_URL}/customers?limit=${limit}`)
  if (!response.ok) return []
  return [{ id: 'customers', name: 'customers' }]
}

export async function fetchInvoices(limit: number): Promise<InvoiceDto[]> {
  const response = await fetch(`${API_BASE_URL}/invoices?limit=${limit}`)
  if (!response.ok) return []
  return [{ id: 'invoices', amount: limit, crew: generatedCrewSchema }]
}
