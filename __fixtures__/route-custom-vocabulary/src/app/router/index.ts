// 装配层聚合两个域的入口（入口叫 entry.ts，由 router kit 声明）
import { crewsEntry } from '@/modules/crews/entry'
import { ordersEntry } from '@/modules/orders/entry'

export const routes = [...crewsEntry, ...ordersEntry]
