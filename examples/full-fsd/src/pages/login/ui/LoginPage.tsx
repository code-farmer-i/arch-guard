import { useTranslation } from 'react-i18next'
import { AppButton } from '@/shared/ui/app-button'

export function LoginPage() {
  const { t } = useTranslation()
  return (
    <section>
      <h1>{t('login.title')}</h1>
      <AppButton>{t('common.retry')}</AppButton>
    </section>
  )
}
