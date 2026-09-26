import { useTranslation } from 'react-i18next'
import { OrderCard, useOrders } from '@/entities/order'
import { ANALYTICS_EVENTS, useTrackView } from '@/shared/lib/analytics'

export function OrdersPage() {
  const { t } = useTranslation()
  const { data: orders, isPending } = useOrders()
  useTrackView(ANALYTICS_EVENTS.ordersView)
  return (
    <section>
      <h2>{t('orders.title')}</h2>
      <p>{isPending ? t('common.loading') : t('orders.count', { count: orders.length })}</p>
      {orders.map((order) => (
        <OrderCard key={order.id} order={order} />
      ))}
    </section>
  )
}
