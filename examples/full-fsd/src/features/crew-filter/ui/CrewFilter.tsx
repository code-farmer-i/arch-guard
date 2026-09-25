import { useTranslation } from 'react-i18next'
import { CrewCard } from '@/entities/crew'
import { AppButton } from '@/shared/ui/app-button'
import { emptyFilter } from '../model/filter'

export function CrewFilter({ options, value }: { options: string[]; value: string }) {
  const { t } = useTranslation()
  const keywords = value || emptyFilter.keywords
  return (
    <div>
      <span>{t('crews.filterLabel')}</span>
      {options.map((option) => (
        <CrewCard key={option} name={option} />
      ))}
      <AppButton>{t('common.retry')}</AppButton>
      <input value={keywords} readOnly />
    </div>
  )
}
