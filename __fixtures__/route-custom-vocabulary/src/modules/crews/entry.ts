// 跨域只经对方入口：目标叫 entry.ts，S04 / S05 照 kit 声明的词汇放行
import { ordersEntry } from '@/modules/orders/entry'

import { helper } from './helpers'

export const crewsEntry = [
  { path: '/crews', lazy: () => import('./views/CrewsPage'), orders: ordersEntry, helper },
]
