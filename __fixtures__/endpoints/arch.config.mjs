import { canonical, endpoints } from '../../es/index.js'

/**
 * 端点唯一出处（R-99 / D25）：`fetch` 的实参里出现路径字面量 → 只许来自声明的出处。
 *
 * - `client.ts` 用 `ENDPOINTS.crews` 拼 → 合规（模板里没有路径字面量）
 * - `useCrews.ts` 直接写 `/crews` → 违规（改接口时漏一处就是 404）
 */
export default {
  // `from` 走来源表（`platform.network` = fetch + XMLHttpRequest）—— 与手写 `apis` 等价，且是平台事实
  presets: [
    canonical(),
    endpoints({ from: 'platform.network', source: 'src/shared/api/endpoints.ts' }),
  ],
  overrides: { enable: ['D25'], ignore: ['arch.config.mjs', 'expect.json'] },
}
