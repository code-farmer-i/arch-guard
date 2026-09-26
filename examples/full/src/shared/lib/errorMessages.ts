/**
 * **错误码 → 文案的唯一出处**（R-111 的推荐形态；本体的判据仍留待真实项目形态 —— 同 N-14 / N-15）。
 *
 * 为什么放一处：同一个错误码在三个页面各写各的说法，客服拿着日志对不上；后端加一个错误码，
 * 得满仓库找哪里该补文案。所以**判断只在这里**，页面只调 `messageOf()`：
 *
 * ```ts
 * // 页面（推荐）
 * const { errorCode } = useCrews()
 * t(messageOf(errorCode))
 * ```
 *
 * 反例（本体暂不判、但别这样写）：在组件里 `if (err.code === 'RATE_LIMIT') setMsg('太频繁了')`。
 */
export const ERROR_MESSAGES = {
  RATE_LIMIT: 'common.errorRateLimit',
  NOT_FOUND: 'common.errorNotFound',
  FORBIDDEN: 'common.errorForbidden',
} as const

export type ErrorCode = keyof typeof ERROR_MESSAGES

/** 拿到错误码 → 给页面返回**文案 key**（不认识或没有码，回退到通用失败文案） */
export function messageOf(code: string | null): string {
  if (code === null) return 'common.loadFailed'
  return ERROR_MESSAGES[code as ErrorCode] ?? 'common.errorUnknown'
}
