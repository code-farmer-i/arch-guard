// 违规：手拼路径字面量（哪怕这个域自己的表里已经有一个）
export const fetchOrders = (): Promise<unknown> => fetch(`/orders?limit=1`)
