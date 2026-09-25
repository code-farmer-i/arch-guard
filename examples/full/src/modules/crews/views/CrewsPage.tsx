import { useTranslation } from 'react-i18next'
import { crewsViewEvent, sendEvent } from '@/shared/lib/analytics'
import { useShellStore } from '@/shared/stores/shell'
import { CrewsTable } from '../components/CrewsTable'
import { useCrews } from '../hooks/useCrews'
import { formatCrewName } from '../lib/format'

export default function CrewsPage() {
  const { t } = useTranslation()
  const crews = useCrews()
  const selected = useShellStore((state) => state.selected)
  sendEvent(crewsViewEvent)
  return (
    <section>
      <h2>{t('crews.title')}</h2>
      <p>{formatCrewName(selected)}</p>
      <CrewsTable rows={crews.map((crew) => crew.name)} />
    </section>
  )
}
