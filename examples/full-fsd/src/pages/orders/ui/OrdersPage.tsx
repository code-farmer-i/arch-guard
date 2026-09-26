import { useTranslation } from 'react-i18next'
import { useCrews } from '@/entities/crew'
import { crewOf, OrderCard, useOrders } from '@/entities/order'
import { can, PERMISSIONS } from '@/shared/auth/permissions'
import { ANALYTICS_EVENTS, useTrackView } from '@/shared/lib/analytics'
import { messageOf } from '@/shared/lib/errorMessages'

export function OrdersPage() {
  const { t } = useTranslation()
  const { data: orders, isPending, isError, errorCode, retry } = useOrders()
  const { data: crews } = useCrews()
  useTrackView(ANALYTICS_EVENTS.ordersView)
  return (
    <section>
      <h2>{t('orders.title')}</h2>
      {can(PERMISSIONS.orderExport) ? <p>{t('orders.exportHint')}</p> : null}
      {isPending ? <p>{t('common.loading')}</p> : null}
      {isError ? (
        <p>
          {/* 错误码 → 文案只走一处（`shared/lib/errorMessages`） */}
          {t(messageOf(errorCode))}
          <button type="button" onClick={retry}>
            {t('common.retry')}
          </button>
        </p>
      ) : null}
      {!isPending && !isError ? (
        <p>{t('orders.count', { count: orders.length })}</p>
      ) : null}
      {orders.map((order) => (
        // 跨实体组合发生在**页面**：两个实体各取各的数据，靠 `crewOf` 配对
        <OrderCard key={order.id} order={order} crew={crewOf(order, crews)} />
      ))}
    </section>
  )
}
