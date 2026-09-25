import { crewsRoutes } from '@/modules/crews/routes'
import { ordersRoutes } from '@/modules/orders/routes'

export const routes = [...crewsRoutes, ...ordersRoutes]
