import { OrderCard } from '../../../entities/order'
import { UserCard } from '../../../entities/user'
import { NotificationsCard } from '../../../entities/notifications'

export function CrewFilter() {
  return [OrderCard, UserCard, NotificationsCard]
}
