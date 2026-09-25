import { canonical } from '../../es/index.js'

/**
 * 场景：声明"相对路径最多向上爬 1 层"之后 ——
 * `../../../shared/lib/format`（3 层）报；`../helper`（1 层）与别名 `@/...` 都不报。
 */
export default {
  presets: [canonical()],
  overrides: {
    enable: ['S43'],
    structure: { maxRelativeUp: { max: 1 } },
    ignore: ['arch.config.mjs', 'expect.json'],
  },
}
