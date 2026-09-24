/**
 * 门禁自己的配置：**狗粮**。
 *
 * arch-guard 是「库 / CLI 工具」，不是应用，所以用 `library()` 范式（库角色表 + 库适用的规则集），
 * 而不是 `canonical()`（三根拓扑 / 路由分片 / 别名）。差异只在这份配置里，引擎一行不改。
 *
 * 只装**真的有消费者**的轴（本仓自己的规矩：声明必须有消费者）。没装的轴不是"忘了"，
 * 而是它们对本项目**不可能成立** —— 理由写在各行注释里；能力未声明的规则会在报告里**明列停用**，
 * 所以"少装一个轴"是可见的，不是静默失能。
 *
 * 跑：pnpm guard:self
 */
import { deps, library, metrics, tsPack } from './es/index.js'

export default {
  // 配置格式版本：与本工具不一致时显式报错，而不是猜（见 CONFIG_SPEC_VERSION）
  specVersion: '1',
  // 框架包：一个项目一个，声明的是**源码形态**（不是"用了哪个框架"）。
  // 本体是纯 TS 库/CLI —— 形态就是 TS/JS 家族，所以用框架无关的 `tsPack`；
  // React 宿主请写 `reactPack`（两者今天共用同一份规则集，差别只在名字与将来 JSX 专属规则的家）。
  // 显式写出来也让 `pack` 的适配面白名单有个明确边界（配了一个包不支持的 facet 会直接报错）。
  packs: [tsPack],
  presets: [
    library({
      // 本体自己的**目录表**：目录名 → 层号（越小越底层）。
      // 库范式没有应用的「域 / 共享层」概念，结构就是「入口 + 这些内部目录」。
      modules: { data: 1, engine: 2, packs: 4, presets: 4 },
      entry: ['index.ts', 'cli.ts'],
    }),
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
    metrics({
      // M09：**门禁链路自检** —— `check` 必须真的跑 test 与 coverage。
      // 防的是"把 test/coverage 从 check 里摘掉"这类改动：那是门禁自己漏跑，只有门禁自己能查。
      tests: { checkChain: { script: 'check', require: ['test', 'coverage'] } },
      // M07：**依赖预算** —— 本体只许一个运行时依赖；要加第二个就改这里（diff 可见、可评审）。
      // 与 P01 的 allow 是同一件事的两面：allow 管"谁被批准"，预算管"一共几个"。
      depsBudget: { runtime: 1 },
      // 不给 coverage：M02–M06 需要一份覆盖率产物，而产物一生成就有"是否比 HEAD 新"的问题
      // （M06 fail-closed）。本仓的覆盖率由 `pnpm check` 里的 `pnpm coverage` 保证，
      // 所以这几条在此**明列停用**而不是让 `pnpm guard:self` 变成"必须先跑覆盖率"。
    }),
    // 不加 hygiene()：它只贡献 H06（脱离上下文的全局 API），而 H06 需要 ui-kit 能力 ——
    //   本项目永远不会用组件库，那会是一条**净贡献 0、永远停用**的声明。
    //   本仓 H 域的覆盖来自 eslint 那侧（H01–H05 按 §4.9 委派）。
    // 不加 designSystem() / copy() / uiKit() / i18n()：没有样式 / 文案 / 组件库 / i18n。
  ],
  overrides: {
    // `ignore` 与 `include` 是两件事，别混：
    //   ignore  = 别碰（不进文件集、不解析、不进依赖图）—— 构建产物 / 示例宿主 / 夹具 / 一次性 spike 属于这类
    //   include = 不判目录契约（但仍会解析、仍进图，供跨域 import 与测试可达根）
    // 所以下面这些不能只靠 `library()` 的 include（那样它们照样会被解析）。
    ignore: [
      'es/**',
      'lib/**',
      'bin/**',
      'examples/**',
      '__fixtures__/**',
      '.scratch/**',
      'pagoda.config.mjs',
      'eslint.config.mjs',
    ],
    // 例外（规则级）挂在这里；本仓目前一条都不需要 ——
    // 曾经的 `exempt: [{ glob: 'src/engine/output.ts' }]` 实测是**净 0**（console 那条规则 H03 已委派 eslint，
    // 本体没有规则会命中它），留着只会让人以为"这个文件免检"。真要写就写成：
    //   exceptions: [{ rule: 'H03', glob: 'src/engine/output.ts', reason: '…', expires: '2026-12-31' }]
  },
}
