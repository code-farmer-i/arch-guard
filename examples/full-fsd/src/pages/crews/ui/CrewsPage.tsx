import { useTranslation } from 'react-i18next'
import { CrewFilter } from '@/features/crew-filter'
import { useShellStore } from '@/shared/lib/shell'
import { ANALYTICS_EVENTS, useTrackView } from '@/shared/lib/analytics'
import { useCrews } from '../api/useCrews'
import { formatCrewStamp } from '../lib/format'

export function CrewsPage() {
  const { t } = useTranslation()
  const crews = useCrews()
  const selected = useShellStore((state) => state.selected)
  useTrackView(ANALYTICS_EVENTS.crewsView)
  return (
    <section>
      <h2>{t('crews.title')}</h2>
      <CrewFilter options={crews} value={selected} />
      <time>{formatCrewStamp()}</time>
    </section>
  )
}
