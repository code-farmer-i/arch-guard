import { canonical, designSystem } from '../../es/index.js'

/**
 * 场景：令牌分层被绕过 —— 色板里混进语义名（`--sh-brand`，它不会随主题变）、
 * 组件样式直接引用底层静态值（`var(--sh-static-gray-3)`，换主题不跟随）。
 */
export default {
  presets: [canonical(), designSystem({ staticPrefix: '--sh-static-' })],
  overrides: { enable: ['D02', 'D18'], ignore: ['arch.config.mjs', 'expect.json'] },
}
