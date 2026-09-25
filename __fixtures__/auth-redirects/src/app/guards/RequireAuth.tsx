// 合规：守卫落点里写跳登录
export function RequireAuth({ token }: { token: string | null }): unknown {
  if (!token) navigate('/login')
  return null
}
