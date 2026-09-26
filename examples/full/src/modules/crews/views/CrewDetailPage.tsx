import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { PageHeader } from '@/shared/components/layout/PageHeader'
import { crewDetail } from '@/shared/config/paths'

export default function CrewDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  return (
    <section>
      <PageHeader title={t('crews.detailTitle')} />
      {/* 跳转一律用构造器（不是手拼模板串）：D23 的唯一出处 */}
      <p data-href={id ? crewDetail(id) : crewDetail('unknown')}>{id}</p>
    </section>
  )
}
