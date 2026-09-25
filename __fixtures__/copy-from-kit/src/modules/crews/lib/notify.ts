// 违规：文案位名单来自 antdKit()（项目没声明 copy({...})）—— 两处裸文案
export const notify = (): void => message.success('保存成功')

export const notifyObject = (): void => {
  notification.open({ message: '保存失败', description: 'no crews', key: 'crews', duration: 3 })
}

// 合规：走 t(...) 的键不算；单 token 与 URL 不算
export const ok = (t: (key: string) => string): string => t('crews.saved')
