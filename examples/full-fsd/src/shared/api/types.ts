export interface CrewDto {
  id: string
  name: string
}

export interface OrderDto {
  id: string
  total: number
  /** 后端字段就叫 crew（值是班组 id）：映射成领域实体的 `crewId` 由 mapper 负责 */
  crew: string
}
