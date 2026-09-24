// 装配层聚合两个域的入口 —— 两个域的入口都叫 routes.ts（不是 .tsx）
import { crewsRoutes } from '@/modules/crews/routes'
import { ordersRoutes } from '@/modules/orders/routes'

export const routes = [...crewsRoutes, ...ordersRoutes]
