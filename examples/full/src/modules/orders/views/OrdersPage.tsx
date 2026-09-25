import { useTranslation } from 'react-i18next'
import { ordersViewEvent, sendEvent } from '@/shared/lib/analytics'
import { useShellStore } from '@/shared/stores/shell'
import { useOrders } from '../hooks/useOrders'

export default function OrdersPage() {
  const { t } = useTranslation()
  const orders = useOrders()
  const selected = useShellStore((state) => state.selected)
  sendEvent(ordersViewEvent)
  return (
    <section>
      <h2>{t('orders.title')}</h2>
      <p>{formatOrderCount(orders.length, selected, t('orders.count', { count: orders.length }))}</p>
    </section>
  )
}

function formatOrderCount(count: number, selected: string, label: string): string {
  return count === 0 ? selected : label
}
