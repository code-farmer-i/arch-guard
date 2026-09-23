import { message, notification, Modal } from 'antd'

// H06 反例：静态调用适配器登记的 detachedApis（应改用 App.useApp()）
export function notify(): void {
  message.success('保存成功')
  notification.error({ message: '加载失败' })
  Modal.confirm({ title: '确认删除？' })
}
