import { axiosKit, callSiteSources, canonical, endpoints, http } from '../../es/index.js'

/**
 * **axios 项目**（R-138）：库的事实进它自己的适配器 —— `axiosKit()` 声明"哪些调用算打后端"，
 * 项目用 `from: callSiteSources.http.apis` 直接引用，**不必手抄库的 API 名**。
 *
 * - `crews` 用端点表里的常量拼 → 合规
 * - `orders` 手拼 `/orders?limit=1` 交给 `axios.get` → D25 报
 */
export default {
  presets: [
    canonical(),
    http(axiosKit()),
    endpoints({ from: callSiteSources.http.apis, source: 'src/shared/api/endpoints.ts' }),
  ],
  overrides: { enable: ['D25'], ignore: ['arch.config.mjs', 'expect.json'] },
}
