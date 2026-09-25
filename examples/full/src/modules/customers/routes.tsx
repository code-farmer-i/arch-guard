import { lazy } from 'react'
import { PATHS } from '@/shared/config/paths'

const CustomersPage = lazy(() => import('./views/CustomersPage'))

export const customerRoutes = [{ path: PATHS.customers, element: <CustomersPage /> }]
