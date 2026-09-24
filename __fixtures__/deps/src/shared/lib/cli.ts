// 反例说明（只在注释里出现，不该被指纹命中）：别用 JSON.parse(JSON.stringify(x)) 做深拷贝
export function joinArgs(argv: string[]): string {
  return argv.join(' ')
}
