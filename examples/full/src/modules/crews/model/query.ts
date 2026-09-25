/**
 * 这个域的**查询契约**：缓存键（D22 的唯一出处）+ 请求策略（D20 的家）。
 *
 * 为什么不放 `shared/api`：`staleTime` / `retry` 是**这个域的数据时效**，键的形状也是域的知识 ——
 * 放共享层，每加一个域都要改那个文件（横向 merge 队列），而域删掉时键与策略还得跨文件清理。
 */
export const crewKeys = {
  list: ['crews'] as const,
  detail: (id: string) => ['crews', id] as const,
}

// 与 queryClient 的全局兜底相同 → 不重复声明（继承全局即可）
