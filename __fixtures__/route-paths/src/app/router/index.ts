import { PATHS } from '@/shared/config/paths'

// 合规：路由表引用唯一出处
export const okRoutes = [{ path: PATHS.orders }]

// 违规：路径字面量（D23）
export const badRoutes = [{ path: '/crews' }]

// 合规：跳转目标来自唯一出处
export const goOrders = (navigate: (to: string) => void): void => navigate(PATHS.orders)

// 违规：跳转目标写成字面量（D23）
export const goCrews = (navigate: (to: string) => void): void => navigate('/crews')
