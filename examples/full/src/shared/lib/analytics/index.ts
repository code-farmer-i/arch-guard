import { ANALYTICS_EVENTS } from './events'

declare function gtag(command: string, name: string): void

/** 埋点上报的唯一落点（S38 callSites）：业务代码只调这里 */
export function sendEvent(eventName: string): void {
  gtag('event', eventName)
}

export const crewsViewEvent = ANALYTICS_EVENTS.crewsView
export const ordersViewEvent = ANALYTICS_EVENTS.ordersView
export const customersViewEvent = ANALYTICS_EVENTS.customersView
export const billingViewEvent = ANALYTICS_EVENTS.billingView
