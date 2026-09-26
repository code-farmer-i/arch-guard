import { FACET_FIELDS } from '../../data/face-forms.js'
import { defineAdapter, defineFacet } from '../../engine/adapters.js'
import type { HttpAdapter } from '../../engine/types.js'

defineFacet('http', {
  fields: [...FACET_FIELDS.http],
  capabilityRoot: 'http',
})

/**
 * 不声明 HTTP 客户端：`endpoints({ apis })` 由项目手写，`from: 'http.apis'` 解析为空数组
 * → D25 明列停用（**不空转**：报告会说清"这条纪律没在跑"）。
 *
 * 为什么也要有个 `none`：面必须由**加载到的 kit**登记（`defineFacet`）—— 只 import `axiosKit`
 * 的项目与只 import `noneHttpKit` 的项目，都不该看到"未知适配器面"。
 */
export function noneHttpKit(): HttpAdapter {
  return defineAdapter<HttpAdapter>('http', {
    id: 'none',
    specVersion: '1',
    packages: [],
    apis: [],
  })
}
