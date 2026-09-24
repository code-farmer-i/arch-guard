// 族模式覆盖：`getDay` / `getSeconds` / `getUTCFullYear` 与**全部 setter** 都该报
// （旧实现只列了 getFullYear / getMonth / getDate / getHours / getMinutes，这些全漏在外面）
export const weekday = (d: Date): number => d.getDay()

export const seconds = (d: Date): number => d.getSeconds()

export const utcYear = (d: Date): number => d.getUTCFullYear()

export function startOfMorning(d: Date): Date {
  const next = new Date(d)
  next.setHours(9, 0, 0, 0)
  return next
}
