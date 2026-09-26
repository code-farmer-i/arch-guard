import type { UseQueryResult } from '@tanstack/react-query'

/**
 * 取数状态的**统一形状**（跨域一致）：页面按状态渲染，而不是 `data ?? []`。
 *
 * 为什么要有它：`data ?? []` 把"加载中""失败""确实没有数据"压成同一个空数组 ——
 * 后端 500 与"这个班组没有成员"长得一模一样，用户看到的是"暂无数据"，故障静默。
 * 这里显式带上 `isPending` / `isError` / `retry`，并**用 mapper 把 DTO 变成领域实体**。
 */
export interface QueryState<T> {
  data: T
  isPending: boolean
  isError: boolean
  /**
   * 后端错误码（没有就是 `null`）。**原始错误对象只在这里露一次** ——
   * 页面不该去摸 `err.code`（同一个错误码在三个页面各写各的说法就散开了）。
   * 页面拿它去查唯一的映射表：`messageOf(code)`（R-111 的推荐形态）。
   */
  errorCode: string | null
  retry: () => void
}

export function queryStateOf<Raw, T>(
  result: UseQueryResult<Raw[]>,
  map: (row: Raw) => T,
): QueryState<T[]> {
  return {
    data: (result.data ?? []).map(map),
    isPending: result.isPending,
    isError: result.isError,
    errorCode: (result.error as { code?: string } | null)?.code ?? null,
    retry: () => {
      void result.refetch()
    },
  }
}
