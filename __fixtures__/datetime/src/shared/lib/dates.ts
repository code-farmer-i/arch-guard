// 自研同名（apiNames 里的 isSameDay）+ 弱指纹（.getTime()）→ P07 warn
export function isSameDay(a: Date, b: Date): boolean {
  return a.getTime() === b.getTime()
}
