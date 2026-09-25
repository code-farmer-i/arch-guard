// 违规：上报散在 hook 里（S38）
export function useCrews(): unknown[] {
  try {
    return loadCrews()
  } catch (error) {
    Sentry.captureException(error)
    return []
  }
}
