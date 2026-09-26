import { useTranslation } from 'react-i18next'

/**
 * 受控筛选控件：**只做"用户能做的事"**（改关键词），列表渲染不归它 ——
 * 特性层是交互，展示复合块归 widgets（照抄时最容易把这两层混掉）。
 */
export function CrewFilter({
  value,
  onChange,
}: {
  value: string
  onChange: (next: string) => void
}) {
  const { t } = useTranslation()
  return (
    <label>
      {t('crews.filterLabel')}
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}
