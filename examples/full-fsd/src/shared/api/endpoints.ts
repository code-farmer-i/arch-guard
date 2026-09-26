/**
 * 后端端点的**唯一出处**（D25）：路径只许出现在这里。
 *
 * 为什么要它：端点以前多写成 `` fetch(`${API_BASE_URL}/crews?limit=${n}`) `` —— 模板串的静态前缀
 * 是空的、纯字面量里也没有它，于是"改接口漏一处 = 404"这件事**任何规则都看不见**。现在端点有名字，
 * 调用点只拼常量，改路径只改这一处。
 */
export const ENDPOINTS = {
  crews: '/crews',
  orders: '/orders',
  customers: '/customers',
  invoices: '/invoices',
}
