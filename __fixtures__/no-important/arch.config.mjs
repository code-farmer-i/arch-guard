import { canonical, designSystem } from '../../es/index.js'

/**
 * 场景：`!important` 只许写在 vendor 目录（覆盖第三方），自家组件样式里不许 ——
 * vendor 里的 `.ant-btn { color: red !important }` 合规，组件样式里的同款写法违规。
 */
export default {
  presets: [canonical(), designSystem({})],
  overrides: { enable: ['D09'], ignore: ['arch.config.mjs', 'expect.json'] },
}
