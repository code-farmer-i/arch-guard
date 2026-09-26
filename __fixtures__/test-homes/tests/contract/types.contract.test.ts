// 合规：真的引用了生成的契约
import type { CrewDto } from '@/shared/api/generated/crews.gen'

export const contract = (dto: CrewDto): string => dto.id
