import type { RouteObject } from 'react-router-dom'
import { CrewsPage } from '@/pages/crews'
import { LoginPage } from '@/pages/login'
import { OrdersPage } from '@/pages/orders'
import { PATHS } from '@/shared/routes'
import { AuthGuard } from '../router/guards/AuthGuard'
import { AppLayout } from '@/widgets/app-layout'

/** 路由表：切片只通过自己的公开面暴露页面 */
export const appRoutes: RouteObject[] = [
  // 登录页在 AuthGuard **之外**（否则未登录会被守卫弹回自己）
  { path: PATHS.login, element: <LoginPage /> },
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
