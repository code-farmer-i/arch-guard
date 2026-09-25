// 违规：域内直连后端（S36）—— 端点与契约类型该进 shared/api
export async function loadOrders() {
  return fetch('/api/orders')
}
