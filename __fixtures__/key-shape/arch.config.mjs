import { canonical, dataLayer, reactQueryKit } from '../../es/index.js'

/**
 * 缓存键形状一致（R-100 / D26）：同一个键工厂里的键必须**同前缀**。
 *
 * `list: ['crews']` 与 `detail: (id) => ['crew', id]`（单数）混用 → `invalidateQueries(['crews'])`
 * 前缀匹配不上，缓存不失效、数据不刷新，而 D22 只管"字面量在不在家"。
 */
export default {
  presets: [
    canonical(),
    dataLayer(reactQueryKit({ queryKeyFrom: 'src/modules/crews/model/query.ts' })),
  ],
  overrides: { enable: ['D26'], ignore: ['arch.config.mjs', 'expect.json'] },
}
