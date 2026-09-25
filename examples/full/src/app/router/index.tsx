import { createBrowserRouter } from 'react-router-dom'
import { PATHS } from '@/shared/config/paths'
import { billingRoutes } from '@/modules/billing/routes'
import { crewRoutes } from '@/modules/crews/routes'
import { customerRoutes } from '@/modules/customers/routes'
import { orderRoutes } from '@/modules/orders/routes'
import { AppLayout } from '../layouts/AppLayout'
import { AuthGuard } from './guards/AuthGuard'

export const appRouter = createBrowserRouter([
  {
    path: PATHS.root,
    element: (
      <AuthGuard>
        <AppLayout />
      </AuthGuard>
    ),
    children: [...crewRoutes, ...orderRoutes, ...customerRoutes, ...billingRoutes],
  },
])
