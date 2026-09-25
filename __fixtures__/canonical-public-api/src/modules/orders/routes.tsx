// 合规：跨域必须经公开面入口（crews 的 routes）
import { crewsRoutes } from '@/modules/crews/routes'

export const ordersRoutes = [...crewsRoutes]
