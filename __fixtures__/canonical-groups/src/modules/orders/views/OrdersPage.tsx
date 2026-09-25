// 违规：跨域直接引用（S22 组隔离）；canonical 下这条以前根本不跑
import { CrewsPage } from '@/modules/crews/views/CrewsPage'

export default function OrdersPage(): unknown {
  return CrewsPage
}
