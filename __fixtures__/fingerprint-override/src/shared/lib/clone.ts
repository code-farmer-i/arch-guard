// 项目认可的封装：项目用 removeSyntax 把这条形态从指纹里删掉了
export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
