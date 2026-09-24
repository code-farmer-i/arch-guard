import { CrewFilter } from '../../../features/crew-filter'
import { CrewCard } from '../../../entities/crew'
import { CrewsWidget } from '../../../widgets/crews-widget'
import { OrderWidget } from '../../../widgets/order-widget'
import { UserWidget } from '../../../widgets/user-widget'

export function CrewsPage() {
  return [CrewFilter, CrewCard, CrewsWidget, OrderWidget, UserWidget]
}
