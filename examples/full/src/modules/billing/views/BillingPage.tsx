import { useTranslation } from 'react-i18next'
import { formatCrewName } from '@/modules/crews' // 跨域只经对方的业务公开面（R-98 / S04·S05）
import { can, PERMISSIONS } from '@/shared/auth/permissions'
import { AppTag } from '@/shared/components/ui/AppTag'
import { PageHeader } from '@/shared/components/common/PageHeader'
import { useDebounce } from '@/shared/hooks/useDebounce'
import { useTenantId } from '@/shared/tenant/context'
import { ANALYTICS_EVENTS, useTrackView } from '@/shared/lib/analytics'
import { messageOf } from '@/shared/lib/errorMessages'
import { useInvoices } from '../hooks/useInvoices'

export default function BillingPage() {
  const { t } = useTranslation()
  const period = useDebounce('')
  const tenantId = useTenantId()
  const { data: invoices, isPending } = useInvoices(period)
  useTrackView(ANALYTICS_EVENTS.billingView)
  return (
    <section>
      <PageHeader title={t('billing.title')} />
      <p>{t('billing.tenant', { tenant: tenantId })}</p>
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
        <p>{t('billing.count', { count: crews.length })}</p>
      ) : null}
      {/* 权限点取常量（D29）：字面量只许出现在 permissions.ts 里 */}
      {can(PERMISSIONS.invoiceEdit) ? <p>{t('billing.editHint')}</p> : null}
      {invoices.map((invoice) => (
        <AppTag key={invoice.id}>{formatCrewName(invoice.crew)}</AppTag>
      ))}
    </section>
  )
}
