import { useTranslation } from 'react-i18next'
import { ANALYTICS_EVENTS, useTrackView } from '@/shared/lib/analytics'
import { messageOf } from '@/shared/lib/errorMessages'
import { useOrders } from '../hooks/useOrders'

export default function OrdersPage() {
  const { t } = useTranslation()
  const { data: orders, isPending } = useOrders()
  useTrackView(ANALYTICS_EVENTS.ordersView)
  return (
    <section>
      <h2>{t('orders.title')}</h2>
      {isPending ? <p>{t('common.loading')}</p> : null}
      {isError ? (
        <p>
          {/* 错误码 → 文案只走一处（`shared/lib/errorMessages`）：页面不碰 `err.code` */}
          {t(messageOf(errorCode))}
          <button type="button" onClick={retry}>
            {t('common.retry')}
          </button>
        </p>
      ) : null}
      {!isPending && !isError ? (
        <p>{t('orders.count', { count: orders.length })}</p>
      ) : null}
    </section>
  )
}
