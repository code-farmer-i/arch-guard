// Node 直跑（node --test / 覆盖率）需要带扩展名；打包器风格的源码里其余 import 保持无扩展名
import { useEffect } from 'react'
import { ANALYTICS_EVENTS } from './events.ts'

// 这个目录的公开面：事件名表从这里出去（页面只声明事件名）
export { ANALYTICS_EVENTS } from './events.ts'

declare function gtag(command: string, name: string): void

/** 真正落地的上报：**不出这个文件**（S38 callSites 的落点），业务只许用 useTrackView */
function sendEvent(eventName: string): void {
  gtag('event', eventName)
}

/**
 * 页面浏览上报：**在 effect 里报一次**。
 *
 * 为什么不让页面直接调 `sendEvent(...)`：写在渲染体里会在**每次重渲染**时上报
 * （StrictMode 下还会双调用）—— 埋点虚高、计费失真，而"事件名是不是字面量"这类规则看不见调用位置。
 * 事件名只来自 `events.ts`（D24 的唯一出处），所以这里的参数永远应该是那个常量表的成员。
 */
export function useTrackView(eventName: string): void {
  useEffect(() => {
    sendEvent(eventName)
  }, [eventName])
}
