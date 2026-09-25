// 违规：页面里直接读原始权限；而 can(...) 这种高层 API 到哪都合法
export default function CrewsPage({ permissions }: { permissions: string[] }): unknown {
  const editable = permissions.includes('crews.edit')
  return can(permissions, 'crews.view') && editable
}
