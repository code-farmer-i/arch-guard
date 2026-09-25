// 违规：页面里自己写了一遍守卫（JSX 形态）
export default function OrdersPage({ token }: { token: string | null }): unknown {
  return token ? null : <Navigate to="/login" />
}
