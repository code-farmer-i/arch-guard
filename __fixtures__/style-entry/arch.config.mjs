import { canonical, designSystem } from '../../es/index.js'

/**
 * 声明的样式落点必须有入口（R-103 / D28）。
 *
 * `styles/base.css` 被应用入口 import 了（合规）；`styles/tokens/*` 与 `styles/vendor/*`
 * 谁也没引 —— 谁也不会加载它们（主题静默不生效，而各条规则各自都"合规"）。
 */
export default {
  presets: [canonical()],
  overrides: { enable: ['D28'], ignore: ['arch.config.mjs', 'expect.json'] },
}
