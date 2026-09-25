// Node 直跑（node --test / 覆盖率）需要带扩展名
import { ANALYTICS_EVENTS } from './events.ts'

declare function gtag(command: string, name: string): void

/** 埋点上报的唯一落点（S38 callSites） */
export function sendEvent(eventName: string): void {
  gtag('event', eventName)
}

export const crewsViewEvent = ANALYTICS_EVENTS.crewsView
export const ordersViewEvent = ANALYTICS_EVENTS.ordersView
