/**
 * 这个实体的**查询契约**：缓存键（D22 的唯一出处）+ 请求策略（D20 的家）。
 *
 * 放实体层而不是 `shared/api`：键的形状与数据时效是**实体的知识**；页面/特性要用就经
 * 实体的公开面（`@/entities/crew`）取 —— 这样加一个实体不用回头改共享层。
 */
export const crewKeys = {
  list: ['crews'] as const,
  detail: (id: string) => ['crews', id] as const,
}

// 与 queryClient 的全局兜底相同 → 继承全局，不重复声明
