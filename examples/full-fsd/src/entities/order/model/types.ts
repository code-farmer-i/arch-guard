export interface Order {
  id: string
  total: number
  /** 后端只给班组 id；要拿到 Crew 实体由页面组合（见 selectors.ts） */
  crewId: string
}
