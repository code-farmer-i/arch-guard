import { useTranslation } from 'react-i18next'
import { ANALYTICS_EVENTS, useTrackView } from '@/shared/lib/analytics'
import { PageHeader } from '@/shared/components/common/PageHeader'
import { useDebounce } from '@/shared/hooks/useDebounce'
import { useCustomers } from '../hooks/useCustomers'

export default function CustomersPage() {
  const { t } = useTranslation()
  const keywords = useDebounce('')
  const { data: customers, isPending } = useCustomers(keywords)
  useTrackView(ANALYTICS_EVENTS.customersView)
  return (
    <section>
      <PageHeader title={t('customers.title')} />
      <p>{isPending ? t('common.loading') : t('customers.count', { count: customers.length })}</p>
    </section>
  )
}
