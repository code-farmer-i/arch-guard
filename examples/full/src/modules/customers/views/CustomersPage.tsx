import { useTranslation } from 'react-i18next'
import { customersViewEvent, sendEvent } from '@/shared/lib/analytics'
import { PageHeader } from '@/shared/components/common/PageHeader'
import { useDebounce } from '@/shared/hooks/useDebounce'
import { useCustomers } from '../hooks/useCustomers'

export default function CustomersPage() {
  const { t } = useTranslation()
  const keywords = useDebounce('')
  const customers = useCustomers(keywords)
  sendEvent(customersViewEvent)
  return (
    <section>
      <PageHeader title={t('customers.title')} />
      <p>{t('customers.count', { count: customers.length })}</p>
    </section>
  )
}
