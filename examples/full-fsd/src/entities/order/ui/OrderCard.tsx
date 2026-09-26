import { useTranslation } from 'react-i18next'
import type { Order } from '../model/types'

export function OrderCard({ order }: { order: Order }) {
  const { t } = useTranslation()
  return <p>{t('orders.count', { count: order.total })}</p>
}
