import type { CrewDto } from '@/shared/api'
import type { Crew } from './types'

/** 显式的 DTO → 领域实体映射：后端字段改名时**这里会报类型错**，而不是静默丢字段 */
export function toCrew(dto: CrewDto): Crew {
  return { id: dto.id, name: dto.name }
}
