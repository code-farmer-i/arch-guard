import { canonical } from '../../es/index.js'

/**
 * 场景：路由表静态 import 页面 → 所有页面随主包一起下载，首屏跟着变大。
 *
 * `canonical({ lazyViews: true })` 声明"页面必须懒加载"后：入口对 view 的**静态** import 一律报。
 * 组件之间的引用不管（那不是首屏问题）。
 */
export default {
  presets: [canonical({ lazyViews: true })],
  overrides: {
    enable: ['S37'],
    ignore: ['arch.config.mjs', 'expect.json'],
  },
}
