import { EVENTS } from '@/shared/lib/analytics/events'

// 违规：渲染体里直接上报
export default function BadPage() {
  sendEvent(EVENTS.crewsView)
  return <div>crews</div>
}
