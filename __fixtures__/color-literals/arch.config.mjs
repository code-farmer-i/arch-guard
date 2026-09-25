import { canonical, designSystem } from '../../es/index.js'

/**
 * 场景：色值只许写进色板 —— 色板与令牌目录里的字面量合规，组件样式里随手写的 hex 违规。
 */
export default {
  presets: [canonical(), designSystem({})],
  overrides: { enable: ['D01'], ignore: ['arch.config.mjs', 'expect.json'] },
}
