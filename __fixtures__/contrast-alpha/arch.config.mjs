import { canonical, designSystem } from '../../es/index.js'

/**
 * R-148：4/8 位 hex（CSS Color 4 的 `#RGBA` / `#RRGGBBAA`）必须**真的按 alpha 求值**。
 *
 * 旧实现把 `#0008` 切成 `[0, 8, NaN]`，一路传成 `contrastRatio = NaN` —— 而 D07 的判据
 * `ratio + 1e-9 < pair.min` 对 NaN **恒为 false**，于是半透明前景压在浅底上（对比度只有 2.6:1）
 * 也**一条不报**。这份夹具就是那条静默假绿：违规必报（`--sh-static-ink-alpha`），合规不报（`--sh-static-ink`）。
 */
export default {
  presets: [
    canonical(),
    designSystem({
      contrastPairs: [
        { fg: '--ink-alpha', bg: '--surface', usage: '半透明正文 / 画布', min: 4.5 },
        { fg: '--ink-strong', bg: '--surface', usage: '不透明正文 / 画布', min: 4.5 },
      ],
    }),
  ],
  // 只开 D07：这条夹具要证明的是"对比度基线看得见半透明"，不是整个 D 域
  overrides: { enable: ['D07'], ignore: ['arch.config.mjs', 'expect.json'] },
}
