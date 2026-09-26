import { useTranslation } from 'react-i18next'
import { useCrews } from '@/entities/crew'
import { crewOf, OrderCard, useOrders } from '@/entities/order'
import { ANALYTICS_EVENTS, useTrackView } from '@/shared/lib/analytics'

export function OrdersPage() {
  const { t } = useTranslation()
  const { data: orders, isPending } = useOrders()
  const { data: crews } = useCrews()
  useTrackView(ANALYTICS_EVENTS.ordersView)
  return (
    <section>
      <h2>{t('orders.title')}</h2>
      <p>{isPending ? t('common.loading') : t('orders.count', { count: orders.length })}</p>
      {orders.map((order) => (
        // 跨实体组合发生在**页面**：两个实体各取各的数据，靠 `crewOf` 配对
        <OrderCard key={order.id} order={order} crew={crewOf(order, crews)} />
      ))}
    </section>
  )
}
