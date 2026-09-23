export function formatWhen(date: Date): string {
  const y = date.getFullYear()
  const m = date.getMonth() + 1
  const d = date.getDate()
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export function shortStamp(): string {
  return new Date().toISOString().slice(0, 10)
}

export function localeLabel(): string {
  return new Date().toLocaleDateString('zh-CN')
}

export function aDayAgo(): number {
  return Date.now() - 86400000
}
