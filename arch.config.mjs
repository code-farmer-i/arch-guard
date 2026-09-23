/**
 * 门禁自己的配置：**狗粮**（R10）。
 *
 * arch-guard 是「库 / CLI 工具」，不是应用，所以用 `library()` 范式（库角色表 + 库适用的规则集），
 * 而不是 `canonical()`（三根拓扑 / 路由分片 / 别名）。差异只在这份配置里，引擎一行不改。
 *
 * 跑：pnpm guard:self
 */
import { library, hygiene, deps } from './es/index.js'

export default {
  presets: [
    library(),
    hygiene(),
    // 能力表：本体用到的能力必须登记首选方案（配合 P06/P08）
    deps({
      capabilities: {
        'cli-args': 'commander',
      },
      allow: ['commander', 'typescript'],
      deny: ['axios', 'swr', 'redux', 'mobx', 'dayjs', 'lodash'],
    }),
  ],
  overrides: {
    // 豁免走官方通道：写清理由，可见、可评审（不用内联注释）
    exempt: [
      {
        glob: 'src/engine/output.ts',
        reason: '门禁的唯一输出出口，console 是它的职责（eslint 同样只对它放行 no-console）',
      },
    ],
    params: {
      // 本体是证据：能力表里登记了 commander，代码里就真的在用 commander
      capabilities: { 'cli-args': 'commander' },
    },
  },
}
