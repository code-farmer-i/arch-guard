import { PATHS } from '@/shared/config/paths'

export function Nav() {
  return (
    <nav>
      {/* 合规：链接目标来自唯一出处 */}
      <Link to={PATHS.crews}>crews</Link>
      {/* 违规：链接目标写成字面量（D23） */}
      <Link to="/orders">orders</Link>
    </nav>
  )
}
