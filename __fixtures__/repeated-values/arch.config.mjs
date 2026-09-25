import { canonical, designSystem } from '../../es/index.js'

/**
 * 场景：`padding: 13px` 在三个组件的样式里各写一遍（项目还没把它变成令牌）——
 * 事实上已经定了口径，只是没有名字。同一 `(属性, 数值)` 跨 ≥3 个**非令牌文件**就提示。
 * 合规侧：白名单里的 `8px`、`display: flex`、颜色、以及令牌文件里的重复值都不提示。
 */
export default {
  presets: [
    canonical(),
    designSystem({
      styleDir: 'src/shared/styles',
      valueWhitelists: [{ rule: 'D12', allow: ['8px'] }],
    }),
  ],
  overrides: { enable: ['D19'], ignore: ['arch.config.mjs', 'expect.json'] },
}
