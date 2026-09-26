import { useTranslation } from 'react-i18next'
import type { Crew } from '@/entities/crew/@x/order'
import type { Order } from '../model/types'

export function OrderCard({ order, crew }: { order: Order; crew?: Crew }) {
  const { t } = useTranslation()
  return (
    <p>
      {t('orders.count', { count: order.total })}
      {crew ? ` · ${crew.name}` : null}
    </p>
  )
}
