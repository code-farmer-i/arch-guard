import { useTranslation } from 'react-i18next'
import { ANALYTICS_EVENTS, useTrackView } from '@/shared/lib/analytics'
import { CrewsTable } from '../components/CrewsTable'
import { useCrews } from '../hooks/useCrews'
import { formatCrewName } from '../lib/format'

export default function CrewsPage() {
  const { t } = useTranslation()
  const crews = useCrews()
  useTrackView(ANALYTICS_EVENTS.crewsView)
  return (
    <section>
      <h2>{t('crews.title')}</h2>
      <CrewsTable rows={crews.map((crew) => formatCrewName(crew.name))} />
    </section>
  )
}
