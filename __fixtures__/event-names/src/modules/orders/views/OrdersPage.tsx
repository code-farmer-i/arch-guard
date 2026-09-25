// 合规：传常量
import { EVENTS } from '@/shared/lib/analytics/events'

export default function OrdersPage(): unknown {
  gtag('event', EVENTS.crewsView)
  return null
}
