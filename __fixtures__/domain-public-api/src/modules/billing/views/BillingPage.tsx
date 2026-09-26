// 合规：跨域走对方的公开面
import { formatCrewName } from '@/modules/crews'

export default function BillingPage() {
  return <span>{formatCrewName('crews')}</span>
}
