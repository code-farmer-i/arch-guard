import { canonical, deps } from '../../es/index.js'

/**
 * 场景：`dependencies` 里躺着 `lodash`，全项目没人 import 它（`dayjs` 有人用 → 不报）。
 * 声明 `deps({ unusedDeps: true })` 后 P08 以 warn 报在 package.json 上（谁清的、怎么清由人决定）：
 * 它**默认关** —— 只按 import 判会误伤自动 JSX 运行时（react）与副作用型依赖。
 */
export default {
  presets: [canonical(), deps({ unusedDeps: true })],
  overrides: { enable: ['P08'], ignore: ['arch.config.mjs', 'expect.json'] },
}
