import { canonical } from '../../es/index.js'

/**
 * 场景（C10 之后）：**canonical 的域就是组维度** —— 声明 `dimension: 'domain'` 后，
 * 按组判定的规则真的在跑：跨域直接引用（S22 组隔离）报；域数量超过上限（S26）报。
 */
export default {
  presets: [canonical()],
  overrides: {
    enable: ['S22', 'S26'],
    structure: {
      isolate: ['domain'],
      groupCountLimits: [{ dimension: 'domain', max: 2 }],
    },
    ignore: ['arch.config.mjs', 'expect.json'],
  },
}
