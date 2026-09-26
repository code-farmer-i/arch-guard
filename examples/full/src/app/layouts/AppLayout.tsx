import { Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { setLocale, useShellStore } from '@/shared/stores/shell'
import { AppButton } from '@/shared/components/ui/AppButton'

export function AppLayout() {
  const { t } = useTranslation()
  const locale = useShellStore((state) => state.locale)
  return (
    <div>
      <h1>{t('common.appName')}</h1>
      <select value={locale} onChange={(event) => setLocale(event.target.value)} aria-label={t('common.appName')}>
        <option value="zh-CN">zh-CN</option>
        <option value="en">en</option>
      </select>
      <AppButton>{t('common.retry')}</AppButton>
      <Outlet />
    </div>
  )
}
