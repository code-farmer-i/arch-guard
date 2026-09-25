// 合规：直连后端就在声明的落点里（shared/api 是端点的家）
export async function loadCrews() {
  return fetch('/api/crews')
}
