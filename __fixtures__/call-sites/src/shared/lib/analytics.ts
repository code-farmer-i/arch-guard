// 合规：埋点与上报的唯一落点（"没同意隐私协议就不上报"这条判断在这儿）
export function track(event: string): void {
  gtag('event', event)
}

export function report(error: unknown): void {
  Sentry.captureException(error)
}
