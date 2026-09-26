import { canonical, endpoints } from '../../es/index.js'

/**
 * 端点表**跟域走**（R-116）：每个域自己的 `model/endpoints.ts`，用 glob 声明成一族落点。
 *
 * 什么时候该这么组织：多团队各管一块后端接口 —— 一个 `shared/api/endpoints.ts` 就是一条
 * 横向 merge 队列（每加 / 下线一个域都要动它）。一个后端、接口变更要整体审阅时，集中更好。
 *
 * - `crews` 用自己表里的常量拼 → 合规
 * - `orders` 手拼 `/orders` 字面量 → D25 报（只许来自声明的落点）
 */
export default {
  presets: [
    canonical(),
    endpoints({ apis: ['fetch'], source: ['src/modules/*/model/endpoints.ts'] }),
  ],
  overrides: { enable: ['D25'], ignore: ['arch.config.mjs', 'expect.json'] },
}
