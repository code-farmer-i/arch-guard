// 大写开头：落在 `scripts/**/[a-z]*.ts` 的字符类之外 → 不进契约域，S01 不该报它
export function Gen(): number {
  return 2
}
