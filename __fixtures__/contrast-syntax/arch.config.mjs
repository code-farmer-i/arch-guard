import { canonical, designSystem } from '../../es/index.js'

/**
 * R-153：颜色词法要认**全部** CSS 写法，不是只认 `#hex`。
 *
 * 旧实现在两处静默漏报：
 * ① D07 —— 色板里写 `rgb(255, 90, 31)` 的令牌 `resolveColor` 返回 null，于是"声明过的对比度对"
 *    **一对都不算**（白字压这个品牌色只有 3.12:1，明明不达标）；
 * ② D03 —— 色值身份是拿 `/#hex/` 抠出来的，`--sh-static-brand: rgb(255, 90, 31)` 取不到键，
 *    于是它和 `--sh-static-brand-copy: #ff5a1f`（同一个色值）不算重复。
 */
export default {
  presets: [
    canonical(),
    designSystem({
      contrastPairs: [{ fg: '--surface', bg: '--brand', usage: '白字压品牌色', min: 4.5 }],
    }),
  ],
  // 只开 D03 / D07：这份夹具要证明的是"颜色词法换 culori 之后这两条都看得见"
  overrides: { enable: ['D03', 'D07'], ignore: ['arch.config.mjs', 'expect.json'] },
}
