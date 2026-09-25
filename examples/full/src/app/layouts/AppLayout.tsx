import { Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AppButton } from '@/shared/components/ui/AppButton'

export function AppLayout() {
  const { t } = useTranslation()
  return (
    <div>
      <h1>{t('common.appName')}</h1>
      <AppButton>{t('common.retry')}</AppButton>
      <Outlet />
    </div>
  )
}
