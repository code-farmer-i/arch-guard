import { useTranslation } from 'react-i18next'

export function OrderCard({ total }: { total: number }) {
  const { t } = useTranslation()
  return <p>{t('orders.count', { count: total })}</p>
}
