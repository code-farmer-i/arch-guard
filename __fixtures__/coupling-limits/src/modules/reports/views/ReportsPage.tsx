import { format } from '@/shared/lib/format'
import { ordersRoutes } from '@/modules/orders/routes'
import { usersRoutes } from '@/modules/users/routes'

export default function ReportsPage(): unknown {
  return [format('x'), ordersRoutes, usersRoutes]
}
