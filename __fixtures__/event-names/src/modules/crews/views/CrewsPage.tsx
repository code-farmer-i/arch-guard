// 违规：事件名直接写字面量
import { EVENTS } from '@/shared/lib/analytics/events'

export default function CrewsPage(): unknown {
  track('crews_view')
  track(EVENTS.crewsView)
  return null
}
