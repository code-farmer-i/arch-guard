import { useEffect } from 'react'
import { EVENTS } from '@/shared/lib/analytics/events'

// 合规：放进 effect（一次渲染只报一次）
export default function GoodPage() {
  useEffect(() => {
    sendEvent(EVENTS.crewsView)
  }, [])
  return <div>crews</div>
}
