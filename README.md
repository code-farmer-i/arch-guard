# arch-guard

把**架构**写成**可判定不变量**的编码门禁：分层与边界、唯一出处、状态纪律、设计系统与魔法数字、文案契约、依赖选型、反退化。

**本工具不是 linter**：单文件语法卫生（any、console、`!important`、颜色字面量、行数上限…）交给
eslint / oxlint / stylelint / knip；我们只做它们做不到的事 —— **跨文件契约与可判定架构红线**
（角色表、域边界、令牌图、CSS Module 双向契约、多语言同构、能力指纹…）。

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

要求 **Node ≥ 22.18**、**TypeScript 5.4 – 6.x**（`typescript@7` 是原生重写，JS 侧不再暴露编译期 API，装到它会明确报错而不是崩在 `undefined`）。

在项目根建 `arch.config.mjs`：

```js
import {
  canonical,
  designSystem,
  copy,
  hygiene,
  uiKit,
  antdKit,
  reactPack,
} from 'arch-guard/presets'

export default {
  packs: [reactPack], // 框架包（一个项目一个）：规则集由它决定
  presets: [
    canonical(), // 应用范式：三根拓扑 / 角色表 / 阈值
    // 范式三选一：canonical()（三根应用）· library()（库 / CLI：入口 + 目录表）·
    // fsd()（Feature-Sliced Design：六层 + 切片 + 片段）
    // 域预设按需叠加（名字 = 域名，见 CONTEXT.md 的域表）：
    //   designSystem()            设计系统（D）
    //   copy() + i18n(i18nextKit({ languages: […] }))   文案 / i18n（C）—— "copy" 是文案的术语，不是复制
    //   i18n(noneI18nKit())       项目不用 i18n 时显式声明（C 域不注册）
    //   deps({ allow })           依赖选型（P）· metrics() 度量（M）· hygiene() 反退化（H）
    //   uiKit(antdKit() | noneKit()) 组件库适配（正交轴）
    // FSD 项目改用 fsd()：六层 + 切片 + 片段 + 公开面（见 docs/ALTERNATIVES.md §3.5）
    designSystem({ … }), // 令牌分层 / 颜色唯一出处 / 对比度（落点默认随范式）
    copy(), // 文案域规则集
    i18n(i18nextKit({ languages: ['zh-CN', 'en'] })), // i18n 能力（换方案只改这一行）
    hygiene(), // 反退化：逃生舱 / 调试残留 / 未完成标记
    uiKit(antdKit()), // 组件库适配器（换库 / 不用库只改这一行）
  ],
  overrides: {
    // 项目差异只写这里
    // include: ['src/**'], // 契约扫描域（默认 = 源码根）；域外文件不判契约，但仍进依赖图
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

换库 = 写一份约 30 行的适配器（`packages` / `vendorSelectors` / `detachedApis` / `examples`）。
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

## 引擎不绑宿主

本包以 npm 包发布，宿主只写 `arch.config.mjs`。三条可机检的不变式由 `arch-guard --self-check-portability` 强制：

| 不变式 | 内容                                                               | 为什么                                                                |
| ------ | ------------------------------------------------------------------ | --------------------------------------------------------------------- |
| P1     | 依赖必须**显式登记**（`node:*` 与白名单第三方）                    | 门禁读你全量源码、跑在 CI：新增依赖要有理由，且不得把宿主拖进版本冲突 |
| P2     | 不得出现宿主项目字面量（宿主名、绝对路径）                         | 换宿主不用改引擎                                                      |
| P3     | 引擎层不得假设项目布局（`engine/**` 不许出现 `'src/'` 这类字面量） | 范式可换：`canonical` / `library` / 自定义目录都靠它                  |

**P1 是审查门，不是"零依赖"洁癖**：要加依赖就改 [portability.ts](./src/engine/portability.ts) 的白名单并说清理由 ——
它挡的是"顺手引进来的依赖没人看过"。P2/P3 与发布方式无关，是引擎能同时服务多种范式的根本。

于是「换一个宿主」是加法：换 `arch.config.mjs` 即可，引擎一行不改。

## 速度

解析（把每个文件拆成规则能读的事实）是全流程里唯一昂贵的一步，所以它的结果**按文件缓存**：

- 键 = `rel + role + 文件内容哈希`；整份缓存的键 = 事实模型版本 + TypeScript 版本。内容或角色一变就重算，
  **绝不会读到旧结果**；图与全局谓词每轮照旧全量重建（`scope` 只过滤报告的语义不受影响）。
- 缓存位置跟 Vite 一样：有 `node_modules` 就写 `node_modules/.arch-guard-cache/facts.json.gz`，
  没有则退回项目根 `.arch-guard-cache/`。每次运行打印命中数与路径，`--no-cache` 可关。
- 实测（3043 个 ts 文件 / 21.5 万行）：冷跑 5.9s → 热跑 **1.2s**。

## 质量保障

```bash
pnpm build                     # pagoda-cli 构建（es/ ESM + lib/ CJS + d.ts）
pnpm typecheck                 # tsc --noEmit
pnpm lint                      # eslint（禁 any / 非空断言 / console）
pnpm test                      # node --test（引擎 API + 夹具端到端 + 单元分支，112 项）
pnpm coverage                  # 覆盖率报告（Node 内置）：98.84% 行 / 93.61% 分支
pnpm check                     # ★ 提交前的完整门禁：build + 类型 + lint + 格式 + 测试 + 三项自检
pnpm self-test                 # 夹具回归：每条规则违规必报 × 合规不报
pnpm self-check-portability    # P1 / P2 / P3
pnpm guard:sample              # 拿 examples/minimal 当宿主跑一遍
pnpm guard:self                # 狗粮：门禁跑自己（library() 范式 + 配置豁免）
```

## 文档

- [`PARADIGM.md`](./PARADIGM.md) —— **通用范式**：三条公理、十个检测原语、五条设计律、目录契约、判定等级、适配器契约、scope 语义。可直接搬到别的仓库当规约。
- [`docs/DESIGN.md`](./docs/DESIGN.md) —— 怎么实现 + 还没做什么：引擎机制、规则清单、已知缺口。
- [`docs/ALTERNATIVES.md`](./docs/ALTERNATIVES.md) —— **替代组合与竞品盘点**：不装本门禁能覆盖多少（≈30/53）、FSD 场景怎么拼、我们立得住的是什么。

## Roadmap

- [x] 体积阈值默认 500 且可配（`overrides.thresholds`）
- [x] P0 骨架：配置 / 扫描 / 事实模型 / 图 / 适配器 / 能力协商 / 棘轮 / scope / 自检
- [x] 结构域与反退化域第一批规则（S00–S16、H01–H05）
- [x] 设计系统域 D01–D18：颜色唯一出处 / 令牌闭合与死令牌 / 明暗双份 / 对比度基线 / storage key / `!important` / vendor 边界 / 框架残留 / 魔法数字三族 / 内联样式 / 样式落点 / CSS Module 契约 / 只消费语义令牌（已覆盖并替代 `check-theme`）
- [x] 依赖域 P01 · P02 · P04–P07：登记白名单 / 禁用库 / 适配表与实际依赖一致 / 图标来源唯一 / 能力必须用登记方案 / 疑似自造轮子（P03 幽灵依赖、P08 声明但未使用按 §4.9 委派给 knip · depcheck）
- [x] 共 **55 条规则**（结构 S · 设计 D · 文案 C · 依赖 P · 退化 H · 度量 M；以 `--stats` 为准）
- [x] **与 lint 生态不交叉**：单文件语法卫生、颜色/`!important`/数值白名单、幽灵依赖、
      文案键存在性等全部**委派**给 eslint / oxlint / stylelint / knip（见 `docs/DESIGN.md` 的「委派清单」）
- [ ] P07 疑似自造轮子（弱指纹 + 命名指纹）、`--verify-deps` 联网成熟度
- [x] 文案域 C01–C06：裸文案 / 键存在 / 多语言一致 / 一文件一命名空间 / 分片聚合 / 死键
- [ ] P3 图规则补齐：层序、域隔离、公开面、可达性、无环
- [ ] 自适应器补齐：数据层 / 路由 / 样式 / i18n（T1）
- [ ] 文档管理块渲染（`--render-docs` / `--check-docs`）
- [ ] Vue / Svelte 框架包（pack 边界已留出）

## 许可

MIT
