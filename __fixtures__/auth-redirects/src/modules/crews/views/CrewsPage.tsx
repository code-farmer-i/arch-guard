// 违规：页面里自己写了一遍守卫（调用形态）
export default function CrewsPage({ token }: { token: string | null }): unknown {
  if (!token) navigate('/login')
  return null
}
