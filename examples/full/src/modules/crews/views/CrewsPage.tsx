import { useTranslation } from 'react-i18next'
import { ANALYTICS_EVENTS, useTrackView } from '@/shared/lib/analytics'
import { can, PERMISSIONS } from '@/shared/auth/permissions'
import { CrewsTable } from '../components/CrewsTable'
import { useCrews } from '../hooks/useCrews'

export default function CrewsPage() {
  const { t } = useTranslation()
  const { data: crews, isPending, isError, retry } = useCrews()
  useTrackView(ANALYTICS_EVENTS.crewsView)
  return (
    <section>
      <h2>{t('crews.title')}</h2>
      {/* 加载 / 失败是**一等状态**：`data ?? []` 会让 500 与"确实没有数据"长得一样 */}
      {isPending ? <p>{t('common.loading')}</p> : null}
      {isError ? (
        <p>
          {t('common.loadFailed')}
          <button type="button" onClick={retry}>
            {t('common.retry')}
          </button>
        </p>
      ) : null}
      {can(PERMISSIONS.crewEdit) ? <p>{t('crews.editHint')}</p> : null}
      <CrewsTable rows={crews} />
    </section>
  )
}
