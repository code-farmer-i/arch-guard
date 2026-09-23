/**
 * 门禁自己的配置：**狗粮**。
 *
 * arch-guard 是「库 / CLI 工具」，不是应用，所以用 `library()` 范式（库角色表 + 库适用的规则集），
 * 而不是 `canonical()`（三根拓扑 / 路由分片 / 别名）。差异只在这份配置里，引擎一行不改。
 *
 * 跑：pnpm guard:self
 */
import { deps, hygiene, library } from './es/index.js'

export default {
  presets: [
    library(),
    hygiene(),
    deps({
      // 能力表：登记了的能力，代码里命中「手搓指纹」却没在用首选方案 → P06。
      // 注意：能力表**不会**顺带开启 P01 依赖白名单（见 docs/adr/0005）—— P01 只由下面的 allow 开启。
      capabilities: { 'cli-args': 'commander' },
      // allow 是 fail-closed 白名单，**只约束 package.json 的 dependencies**：
      // 声明了它就等于「没登记 = 没批准」。本体唯一的运行时依赖就是 commander。
      // （typescript 是 peer + dev，不在这条规则的扫描范围内，所以不登记。）
      //
      // 不写 deny：白名单已经覆盖它 —— 任何新依赖（含 axios/dayjs/lodash）都会被 P01 拦下。
      // 黑名单只会在白名单之外再造一份名册，多一处要同步的真相。
      allow: ['commander'],
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
  },
}
