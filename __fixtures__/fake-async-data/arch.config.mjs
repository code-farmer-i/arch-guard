import { canonical, hygiene } from '../../es/index.js'

/**
 * 场景：用睡眠冒充异步（`new Promise(r => setTimeout(r, 300))`）、以及 mock 命名的假数据文件
 * 留在生产路径。合规侧：只做防抖的定时器（不包 Promise）不报；测试文件豁免。
 */
export default {
  presets: [canonical(), hygiene()],
  overrides: { enable: ['H07', 'H09'], ignore: ['arch.config.mjs', 'expect.json'] },
}
