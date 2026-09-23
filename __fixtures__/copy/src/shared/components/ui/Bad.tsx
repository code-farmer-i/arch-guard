export function Bad({ t }: { t: (key: string) => string }) {
  return (
    <div>
      <span>写死的文案</span>
      <span>{t('nav.crews')}</span>
      <span>{t('nav.missing')}</span>
    </div>
  )
}
