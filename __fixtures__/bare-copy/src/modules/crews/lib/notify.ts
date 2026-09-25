// 违规：组件库调用里的文案没走 t()（直接实参与对象实参两种形态）
export const notify = (): void => message.success('保存成功')

export const notifyObject = (): void => {
  notification.open({ message: '保存失败', description: 'no crews' })
}
