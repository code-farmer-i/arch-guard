import { lazy } from 'react'
import { PATHS } from '@/shared/config/paths'

const CrewsPage = lazy(() => import('./views/CrewsPage'))

export const crewRoutes = [{ path: PATHS.crews, element: <CrewsPage /> }]
