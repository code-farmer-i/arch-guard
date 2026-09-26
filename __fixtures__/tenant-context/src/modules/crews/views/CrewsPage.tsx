export default function CrewsPage({ searchParams }: { searchParams: URLSearchParams }) {
  // 违规：租户 id 从 URL 随手读（换租户来源时漏一处 = 请求打到默认租户）
  const tenantId = searchParams.get('tenantId')
  // 合规：同样的 API，但实参不在名单里（args 把这一类收窄了）
  const page = searchParams.get('page')
  // 合规：无字面量实参 —— 看不见，不猜
  const dynamic = searchParams.get(process.env.KEY ?? 'x')
  return <span>{`${tenantId}/${page}/${dynamic}`}</span>
}
