// 跨域只经对方的公开面入口：目标叫 routes.ts，S04 / S05 必须放行
import { ordersRoutes } from '@/modules/orders/routes'

import { helper } from './helpers'

export const crewsRoutes = [
  { path: '/crews', lazy: () => import('./views/CrewsPage'), orders: ordersRoutes, helper },
]
