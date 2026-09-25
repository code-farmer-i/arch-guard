// 违规：跨域用相对路径（应该走 @/modules/...）
import { OrdersPage } from '../../orders/views/OrdersPage'
import { helper } from './helper'

export default function CrewsPage(): unknown {
  return [OrdersPage, helper]
}
