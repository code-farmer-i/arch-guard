import type { Crew } from '@/entities/crew/@x/order'
import type { Order } from './types'

/**
 * 跨实体组合：订单只经 crew 的 **`@x/order`** 公开面拿它的类型（官方唯一出口，R-105）。
 * 数据仍各归各的实体 —— 页面拿到 crews 后在这里配对，不做"实体间直接依赖"。
 */
export function crewOf(order: Order, crews: Crew[]): Crew | undefined {
  return crews.find((crew) => crew.id === order.crewId)
}
