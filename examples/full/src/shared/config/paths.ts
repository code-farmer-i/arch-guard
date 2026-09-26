/**
 * 路由路径的唯一出处（D23）：路由表 / 链接 / 跳转都引用这里。
 *
 * **参数化路径**也要有表达方式：模式给路由表用（`crewsDetail`），构造器给跳转用（`crewDetail(id)`）。
 * 否则域内只能手写 `` `/crews/${id}` `` —— 模板串不是字符串字面量，D23 看不见，唯一出处就出现了暗门。
 */
export const PATHS = {
  root: '/',
  crews: '/crews',
  crewsDetail: '/crews/:id',
  orders: '/orders',
  customers: '/customers',
  billing: '/billing',
  login: '/login',
}

/** 参数化路径的构造器：跳转时用它，别手拼模板串 */
export const crewDetail = (id: string): string => `${PATHS.crews}/${id}`
