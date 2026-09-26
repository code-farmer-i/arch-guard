import { useTranslation } from 'react-i18next'
import { OrderCard } from '@/entities/order'
import { ANALYTICS_EVENTS, useTrackView } from '@/shared/lib/analytics'
import { useOrders } from '../api/useOrders'

export function OrdersPage() {
  const { t } = useTranslation()
  const totals = useOrders()
  useTrackView(ANALYTICS_EVENTS.ordersView)
  return (
    <section>
      <h2>{t('orders.title')}</h2>
      <OrderCard total={totals.length} />
    </section>
  )
}
