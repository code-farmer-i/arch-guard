import { can, PERMISSIONS } from '@/shared/auth/permissions'

export default function CrewsPage() {
  // 合规：传常量
  const allowed = can(PERMISSIONS.crewEdit)
  // 违规：直接写字面量
  const alsoAllowed = can('crew:edit')
  return <span>{`${allowed}/${alsoAllowed}`}</span>
}
