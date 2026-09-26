export const crewKeys = {
  list: ['crews'] as const,
  // 违规：同一个键工厂里前缀不一致（多数是 crews，这里是 crew）
  detail: (id: string) => ['crew', id] as const,
}
