import { lazy } from 'react'
import { PATHS } from '@/shared/config/paths'

const BillingPage = lazy(() => import('./views/BillingPage'))

export const billingRoutes = [{ path: PATHS.billing, element: <BillingPage /> }]
