// 违规：静态 import 页面 → 它随主包一起下载（S37）
import OrdersPage from './views/OrdersPage'

export const ordersRoutes = [{ path: '/orders', element: <OrdersPage /> }]
