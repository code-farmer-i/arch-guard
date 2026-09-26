import { useTranslation } from 'react-i18next'
import { ANALYTICS_EVENTS, useTrackView } from '@/shared/lib/analytics'
import { formatCrewName } from '@/modules/crews' // 跨域只经对方的业务公开面（R-98 / S04·S05）
import { AppTag } from '@/shared/components/ui/AppTag'
import { PageHeader } from '@/shared/components/common/PageHeader'
import { useDebounce } from '@/shared/hooks/useDebounce'
import { useInvoices } from '../hooks/useInvoices'

export default function BillingPage() {
  const { t } = useTranslation()
  const period = useDebounce('')
  const invoices = useInvoices(period)
  useTrackView(ANALYTICS_EVENTS.billingView)
  return (
    <section>
      <PageHeader title={t('billing.title')} />
      <p>{t('billing.count', { count: invoices.length })}</p>
      {invoices.map((invoice) => (
        <AppTag key={invoice.id}>{formatCrewName(invoice.crew)}</AppTag>
      ))}
    </section>
  )
}
