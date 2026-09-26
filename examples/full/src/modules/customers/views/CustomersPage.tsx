import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/shared/components/common/PageHeader'
import { ANALYTICS_EVENTS, useTrackView } from '@/shared/lib/analytics'
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
      <p>{isPending ? t('common.loading') : t('customers.count', { count: customers.length })}</p>
    </section>
  )
}
