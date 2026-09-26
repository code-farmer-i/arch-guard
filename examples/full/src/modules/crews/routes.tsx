import { lazy } from 'react'
import { PATHS } from '@/shared/config/paths'

const CrewsPage = lazy(() => import('./views/CrewsPage'))
const CrewDetailPage = lazy(() => import('./views/CrewDetailPage'))

export const crewRoutes = [
  { path: PATHS.crews, element: <CrewsPage /> },
  // 参数化路径：路由表用**模式**（`/crews/:id`），跳转用构造器
  { path: PATHS.crewsDetail, element: <CrewDetailPage /> },
]
