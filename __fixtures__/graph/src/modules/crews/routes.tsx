import type { RouteObject } from 'react-router-dom'

import CrewsPage from './views/CrewsPage'

export const crewRoutes: RouteObject[] = [{ path: '/crews', element: String(CrewsPage) }]
