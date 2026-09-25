import { useTranslation } from 'react-i18next'
import { OrderCard } from '@/entities/order'
import { ordersViewEvent, sendEvent } from '@/shared/lib/analytics'
import { useOrders } from '../api/useOrders'

export function OrdersPage() {
  const { t } = useTranslation()
  const totals = useOrders()
  sendEvent(ordersViewEvent)
  return (
    <section>
      <h2>{t('orders.title')}</h2>
      <OrderCard total={totals.length} />
    </section>
  )
}
