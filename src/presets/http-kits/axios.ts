import { FACET_FIELDS } from '../../data/face-forms.js'
import { defineAdapter, defineFacet } from '../../engine/adapters.js'
import type { HttpAdapter } from '../../engine/types.js'

defineFacet('http', {
  fields: [...FACET_FIELDS.http],
  capabilityRoot: 'http',
})

/**
 * **哪些 axios 调用算"打后端"**（D25 的端点判据用它；`endpoints({ from: callSiteSources.http.apis })`）。
 *
 * **只列请求方法，不列裸 `axios`**：裸 `axios` 按"对象前缀"会把 `axios.create({ baseURL: '/api' })`
 * 里的路径字面量也认成打后端 —— 那是误报（`baseURL` 是合法写法）。
 *
 * 两种认不出来的形态由项目自己补进 `apis`：
 * - `const api = axios.create(); api.get('/crews')` → 实例名不可知，补 `'api.get'`
 * - `axios('/crews')`（可调用形态）→ 补 `'axios'`（补了就要接受 `axios.create` 的误报，自己权衡）
 */
export const AXIOS_APIS: string[] = [
  'axios.request',
  'axios.get',
  'axios.post',
  'axios.put',
  'axios.patch',
  'axios.delete',
  'axios.head',
  'axios.options',
]

export function axiosKit(): HttpAdapter {
  return defineAdapter<HttpAdapter>('http', {
    id: 'axios',
    specVersion: '1',
    packages: ['axios'],
    apis: [...AXIOS_APIS],
  })
}
