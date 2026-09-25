import { canonical } from '../../es/index.js'

/**
 * 场景：`src/legacy/**` 是待迁走的旧代码，但新写的 `modules/crews/lib/price.ts` 还在
 * `import { oldPrice } from '@/legacy/pricing'` —— legacy 从"待清理"变成"事实上的核心"。
 *
 * 声明 `migrating` 后：外面引用它 → 报；它自己引用 `shared` → 不报（只出不进）。
 */
export default {
  presets: [canonical()],
  overrides: {
    enable: ['S40'],
    structure: { migrating: ['src/legacy/**'] },
    ignore: ['arch.config.mjs', 'expect.json'],
  },
}
