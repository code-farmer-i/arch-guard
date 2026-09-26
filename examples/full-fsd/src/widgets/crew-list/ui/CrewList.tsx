import { CrewCard } from '@/entities/crew'
import type { Crew } from '@/entities/crew'

/**
 * 「班组列表」是**展示复合块**（页面里一大块独立内容、且会在多处复用）——
 * 按官方分层语义它属于 **widgets**：特性层放"用户能做的事"（交互），页面只做组装。
 */
export function CrewList({ crews }: { crews: Crew[] }) {
  return (
    <div>
      {crews.map((crew) => (
        <CrewCard key={crew.id} crew={crew} />
      ))}
    </div>
  )
}
