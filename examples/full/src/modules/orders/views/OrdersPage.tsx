import { useTranslation } from 'react-i18next'
import { ANALYTICS_EVENTS, useTrackView } from '@/shared/lib/analytics'
import { useOrders } from '../hooks/useOrders'

export default function OrdersPage() {
  const { t } = useTranslation()
  const orders = useOrders()
  useTrackView(ANALYTICS_EVENTS.ordersView)
  return (
    <section>
      <h2>{t('orders.title')}</h2>
      <p>{t('orders.count', { count: orders.length })}</p>
    </section>
  )
}
