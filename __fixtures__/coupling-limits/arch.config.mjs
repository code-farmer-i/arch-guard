import { canonical } from '../../es/index.js'

/**
 * 场景：`crews`、`orders`、`users` 都在 import `crews` 的组件 —— 改 `crews` 一个 props 得同时改三个域。
 * 声明耦合上限后：被 2 个组依赖的「crews」与依赖 2 个组的「reports」各报一条。
 *
 * 合规侧：`orders` / `users` 只依赖 1 个组（crews），`reports` 只被 0 个组依赖 —— 都不报。
 */
export default {
  presets: [canonical()],
  overrides: {
    enable: ['S39'],
    structure: {
      couplingLimits: [{ dimension: 'domain', maxFanIn: 1, maxFanOut: 1 }],
    },
    ignore: ['arch.config.mjs', 'expect.json'],
  },
}
