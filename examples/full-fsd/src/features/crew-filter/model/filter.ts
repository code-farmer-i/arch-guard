import type { Crew } from '@/entities/crew'

export interface CrewFilterState {
  keywords: string
}

export const emptyFilter: CrewFilterState = { keywords: '' }

/** 筛选是**纯函数**：受控组件只管值，行为在这里（好测） */
export function applyFilter(crews: Crew[], keywords: string): Crew[] {
  const needle = keywords.trim().toLowerCase()
  if (needle === '') return crews
  return crews.filter((crew) => crew.name.toLowerCase().includes(needle))
}
