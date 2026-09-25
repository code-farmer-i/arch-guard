import { canonical, designSystem } from '../../es/index.js'

/**
 * 场景：间距 / 层级 / 时长各写各的数（`margin: 13px`、`z-index: 9999`、`200ms`）——
 * 声明三族白名单后，不在刻度里的数值就报；声明过的那几个值（4px / 8px / 1 / 10 / 150ms）不报。
 */
export default {
  presets: [
    canonical(),
    designSystem({
      valueWhitelists: [
        { rule: 'D12', allow: ['4px', '8px'] },
        { rule: 'D13', allow: ['1', '10'] },
        { rule: 'D14', allow: ['150ms'] },
      ],
    }),
  ],
  overrides: { enable: ['D12', 'D13', 'D14'], ignore: ['arch.config.mjs', 'expect.json'] },
}
