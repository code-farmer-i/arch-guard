// 违规：直捣别域内部文件（不走公开面）
import { formatCrewName } from '@/modules/crews/lib/format'

export const bad = formatCrewName('x')
