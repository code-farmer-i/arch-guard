// 合规：原始权限形态的唯一落点
export function can(permissions: string[], wanted: string): boolean {
  return permissions.includes(wanted)
}
