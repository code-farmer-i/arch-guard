import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/shared/components/common/PageHeader'
import { ANALYTICS_EVENTS, useTrackView } from '@/shared/lib/analytics'
import { messageOf } from '@/shared/lib/errorMessages'
import { useTenantId } from '@/shared/tenant/context'
import { useDebounce } from '@/shared/hooks/useDebounce'
import { useCustomers } from '../hooks/useCustomers'

export default function CustomersPage() {
  const { t } = useTranslation()
  const keywords = useDebounce('')
  const tenantId = useTenantId() // 租户只从声明的落点拿（R-110）
  const { data: customers, isPending } = useCustomers(keywords)
  useTrackView(ANALYTICS_EVENTS.customersView)
  return (
    <section>
      <PageHeader title={t('customers.title')} />
      <p>{t('customers.tenant', { tenant: tenantId })}</p>
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
        <p>{t('customers.count', { count: customers.length })}</p>
      ) : null}
    </section>
  )
}
