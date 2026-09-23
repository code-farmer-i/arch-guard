# arch-guard

把**架构**写成**可判定不变量**的编码门禁：分层与边界、唯一出处、状态纪律、设计系统与魔法数字、文案契约、依赖选型、反退化。

它不是又一个 linter —— **红线只落在可判定的等级上（L1 路径 / L2 单文件 AST / L3 依赖图），语义判断（「命名好不好」「该不该拆」）一律不写进红线**，所以它零误报，能长期活在 CI 里。

> 有骨架、可跑、已发布形态就绪；规则集在持续补齐（见文末 Roadmap）。

## 为什么需要它

agent 写代码最典型的退化不是语法错误，而是**结构退化**：

- 把业务逻辑塞进 `shared/lib` 的一个「通用」函数文件（依赖规则全过）
- 复制粘贴一份实现，而不是把共用逻辑提升到共享层
- 在组件里直接 `fetch`，query key 随手写字面量
- 顺手留 `TODO` / `console.log` / `as any` / 空 `catch`
- 一个文件长到 800 行

这些 eslint 与 tsc 都管不到。arch-guard 把它们变成可执行的检查。

## 安装与运行

```bash
pnpm add -D arch-guard
```

在项目根建 `arch.config.mjs`：

```js
import { canonical, designSystem, copy, hygiene, uiKit, antdKit } from 'arch-guard/presets'

export default {
  presets: [
    canonical(), // 应用范式：三根拓扑 / 角色表 / 阈值
    // 库或 CLI 工具改用 library()：库角色表 + 库适用规则集（见 PARADIGM.md §11.1）
    designSystem({ tokenPrefix: '--sh' }), // 令牌分层 / 颜色唯一出处 / 对比度
    copy({ languages: ['zh-CN', 'en'] }), // 文案契约
    hygiene(), // 反退化：逃生舱 / 调试残留 / 未完成标记
    uiKit(antdKit()), // 组件库适配器（换库 / 不用库只改这一行）
  ],
  overrides: {
    // 项目差异只写这里
  },
}
```

跑起来：

```bash
npx arch-guard                          # 全项目检查
npx arch-guard --scope=changed           # 只报告 git 变更文件（含未跟踪）
npx arch-guard --domain=D --format=json  # 只看设计系统，输出 JSON（给 agent / CI）
npx arch-guard --update-baseline         # 把存量违规写进棘轮基线
```

## 三种用法：用库 / 换库 / 不用库

组件库是**可选、可替换**的配置轴。引擎里不允许出现任何具体库名：

```js
uiKit(antdKit()) // 用 antd
uiKit(noneKit()) // 不用组件库：vendor / 全局 API / 图标来源相关规则不注册
```

换库 = 写一份约 30 行的适配器（`packages` / `vendorSelectors` / `detachedApis` / `styleProps` / `examples`）。
`data/kit-fingerprints.ts` 内置已知组件库指纹，于是**换库后旧库残留一条不剩是可判定验收条件**。

## 检测范围（scope）

> **scope 只过滤报告，不过滤正确性。**

单文件规则可以局部判定（`any`、命名、体积），但全图谓词（域隔离、无环、可达性）与全局唯一性（颜色唯一、死令牌、双份一致）**必须全项目求值**。所以 arch-guard 的做法是：**facts 按文件缓存（增量），图与全局谓词每轮全量重建** —— 快，且不会出现 stale-cache 假绿。

| 场景        | 命令                                          |
| ----------- | --------------------------------------------- |
| CI / 提交前 | `--scope=full`（默认）                        |
| pre-commit  | `--scope=staged`（读 index 内容，不读工作区） |
| agent 迭代  | `--scope=changed`（含未跟踪文件）             |
| PR          | `--scope=since:origin/main`                   |

**安全语义**：不可归属的全局违规默认仍然失败（只有显式 `--local-only` 才允许跳过并列出条数）；无 git / 空 diff 会明确提示降级，绝不静默；`--changed` + `--update-baseline` 被拒绝。

## 棘轮

存量违规写进 `arch.baseline.json`：条目 = `规则 + 文件 + 稳定锚点`（单行取规范化行文本哈希）。

**被豁免的那行代码一改，豁免立即失效** —— 逼着清偿，而不是把门禁关掉。基线只减不增，过期条目会在全量模式提示删除。

豁免只有两条官方通道：config 结构性白名单、基线。**没有内联豁免注释**（连 `eslint-disable` 都是红线 H02）。

## 本体自包含（可抽取）

本包引擎与预设有三条可机检的不变式，`arch-guard --self-check-portability` 强制：

| 不变式 | 内容                                                                       |
| ------ | -------------------------------------------------------------------------- |
| P1     | 只依赖 `node:*`、白名单第三方（`typescript`、`commander`）与本体内相对路径 |
| P2     | 不得出现宿主项目字面量（宿主名、绝对路径）                                 |
| P3     | 引擎层不得假设项目布局（`engine/**` 不许出现 `'src/'` 这类字面量）         |

于是「搬到别的仓库」是加法：换 `arch.config.mjs` 即可，引擎一行不改。

## 质量保障

```bash
pnpm build                     # pagoda-cli 构建（es/ ESM + lib/ CJS + d.ts）
pnpm typecheck                 # tsc --noEmit
pnpm lint                      # eslint（禁 any / 非空断言 / console）
pnpm test                      # node --test（引擎 API + 夹具端到端）
pnpm self-test                 # 夹具回归：每条规则违规必报 × 合规不报
pnpm self-check-portability    # P1 / P2 / P3
pnpm guard:sample              # 拿 examples/minimal 当宿主跑一遍
pnpm guard:self                # 狗粮：门禁跑自己（library() 范式 + 配置豁免）
```

## 文档

- [`PARADIGM.md`](./PARADIGM.md) —— **通用范式**：三条公理、十个检测原语、五条设计律、目录契约、判定等级、适配器契约、scope 语义。可直接搬到别的仓库当规约。
- [`docs/SPEC.md`](./docs/SPEC.md) —— 完整设计：引擎实现、60 条规则清单、架构自审（18 项）、抽取清单。

## Roadmap

- [x] P0 骨架：配置 / 扫描 / 事实模型 / 图 / 适配器 / 能力协商 / 棘轮 / scope / 自检
- [x] 结构域与反退化域第一批规则（S00–S16、H01–H05）
- [ ] P1 设计系统域：令牌图、明暗双份、对比度、魔法数字（迁移自 `check-theme` 的能力）
- [x] 依赖域：P01 登记白名单 / P02 禁用库 / P03 幽灵依赖 / P06 能力必须用登记方案 / P08 登记方案未被使用
- [ ] P07 疑似自造轮子（弱指纹 + 命名指纹）、`--verify-deps` 联网成熟度
- [ ] 文案域：键存在 / 双份同构 / 死键
- [ ] P3 图规则补齐：层序、域隔离、公开面、可达性、无环
- [ ] 自适应器补齐：数据层 / 路由 / 样式 / i18n（T1）
- [ ] 文档管理块渲染（`--render-docs` / `--check-docs`）
- [ ] Vue / Svelte 框架包（pack 边界已留出）

## 许可

MIT
