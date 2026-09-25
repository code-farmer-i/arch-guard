import type { RouteObject } from 'react-router-dom'
import { CrewsPage } from '@/pages/crews'
import { OrdersPage } from '@/pages/orders'
import { PATHS } from '@/shared/routes'
import { AuthGuard } from '../router/guards/AuthGuard'
import { AppLayout } from './AppLayout'

/** 路由表：切片只通过自己的公开面暴露页面 */
export const appRoutes: RouteObject[] = [
  {
    path: PATHS.root,
    element: (
      <AuthGuard>
        <AppLayout />
      </AuthGuard>
    ),
    children: [
      { path: PATHS.crews, element: <CrewsPage /> },
      { path: PATHS.orders, element: <OrdersPage /> },
    ],
  },
]
