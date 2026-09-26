// 违规：直接引内部组件（重构就要改 e2e）
import CrewsPage from '@/modules/crews/views/CrewsPage'

export const e2eBad = (): unknown => CrewsPage
