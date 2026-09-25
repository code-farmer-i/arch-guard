import { lazy } from 'react'
import { PATHS } from '@/shared/config/paths'

const OrdersPage = lazy(() => import('./views/OrdersPage'))

export const orderRoutes = [{ path: PATHS.orders, element: <OrdersPage /> }]
