// 违规：页面里直接用存储与埋点（S38）—— 换成项目里的封装
export default function CrewsPage() {
  const token = localStorage.getItem('token')
  gtag('event', 'crews_view')
  return <div>{token}</div>
}
