// 违规：端点在这里第二次出现（手拼路径字面量）
export const refetch = (): Promise<unknown> => fetch(`/crews?limit=1`)
