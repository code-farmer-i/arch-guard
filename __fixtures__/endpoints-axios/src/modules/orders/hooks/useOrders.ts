import axios from 'axios'

// 违规：手拼路径字面量交给 axios.get
export const fetchOrders = (): Promise<unknown> => axios.get('/orders?limit=1')
