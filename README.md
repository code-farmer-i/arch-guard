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
  // 框架包（一个项目一个）：声明的是**源码形态**，不是"用了哪个框架"。
  // React 应用用 reactPack；库 / CLI / 纯 TS 项目用 tsPack（两者今天共用同一份规则集）。
  packs: [reactPack],
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
    //
    // 域轴可以按需自由组合；`stack()` 只是把这些**原子预设**拼好的糖（不含任何硬编码，
    // 组件库 / i18n 方案 / 语言 / 白名单全部由你传；不传就是"声明空能力"，对应规则明列停用）：
    ...stack({
      i18n: i18nextKit({ languages: ['zh-CN', 'en'] }), // 换 i18n 方案只改这一行
      uiKit: antdKit(), // 换组件库 / 不用库只改这一行
      deps: { allow: ['react', 'react-dom', 'antd', 'i18next', 'react-i18next'] },
    }),
    // 不用 stack() 就照它展开写：
    //   designSystem({ … }) · copy() · deps({ allow }) · hygiene() · i18n(kit) · uiKit(kit)
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
npx arch-guard --update-coverage         # 刷新覆盖率棘轮快照（M04；不是豁免违规）
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

**安全语义**：不可归属的全局违规默认仍然失败（只有显式 `--local-only` 才允许跳过并列出条数）；无 git / 空 diff 会明确提示降级，绝不静默；`include` 非空却 0 个文件由 S24 直接报错。

## 例外：规则级，且必须指名

**违规没有存量豁免**：没有基线、没有"一键把当前违规记下来"。不合规就是红 —— 这是刻意的取舍，
因为任何"先把存量记下来"的通道最终都会变成日常动作，而不是例外。

唯一的宽松通道是 `arch.config.mjs` 的 **规则级例外**：

```js
overrides: {
  exceptions: [
    // 「这条规则对这类文件不适用」——不是「这个文件免检」
    { rule: 'H03', glob: 'src/engine/output.ts', reason: '门禁的唯一输出出口', expires: '2026-12-31' },
  ],
}
```

- `rule` 必须真实存在（拼错直接报错）；`reason` 必填；`expires` 写了就**过期即红**。
- 文件照常有角色、进依赖图、被**其它**规则判定 —— 只有指名的那条规则被摘掉。
- 每次运行都会指名列出每条例外（命中几处 / 未命中），未命中的会提示"可能可以删掉"。
- **没有内联豁免注释**（连 `eslint-disable` 都是红线 H02）。

> 别和 **覆盖率棘轮**（M04）混淆：它比的是覆盖率快照（`--update-coverage` 维护），不豁免任何违规。

## 引擎不绑宿主

本包以 npm 包发布，宿主只写 `arch.config.mjs`。**四条**可机检的不变式由 `arch-guard --self-check-portability` 强制：

| 不变式 | 内容                                                               | 为什么                                                                |
| ------ | ------------------------------------------------------------------ | --------------------------------------------------------------------- |
| P1     | 依赖必须**显式登记**（`node:*` 与白名单第三方）                    | 门禁读你全量源码、跑在 CI：新增依赖要有理由，且不得把宿主拖进版本冲突 |
| P2     | 不得出现宿主项目字面量（宿主名、绝对路径）                         | 换宿主不用改引擎                                                      |
| P3     | 引擎层不得假设项目布局（`engine/**` 不许出现 `'src/'` 这类字面量） | 范式可换：`canonical` / `library` / 自定义目录都靠它                  |
| P4     | 库名只许出现在数据表（`data/*`）与适配器面（`presets/<面>/*`）     | 同一引擎要能服务多种宿主与技术选型；名单从允许位置自己长出来          |

**P1 是审查门，不是"零依赖"洁癖**：要加依赖就改 [portability.ts](./src/engine/portability.ts) 的白名单并说清理由 ——
它挡的是"顺手引进来的依赖没人看过"。P2/P3 与发布方式无关，是引擎能同时服务多种范式的根本；P4 是"同一引擎服务多种技术选型"的总保证。

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
pnpm test                      # node --test（引擎 API + 夹具端到端 + 单元分支）
pnpm coverage                  # 覆盖率报告（Node 内置）
pnpm check                     # ★ 提交前的完整门禁：build + 类型 + lint + 格式 + 测试 + 覆盖率 + 三项自检 + 示例宿主 + 狗粮
pnpm self-test                 # 夹具回归：每条规则违规必报 × 合规不报
pnpm self-check-portability    # P1 / P2 / P3 / P4
pnpm guard:sample              # 拿 examples/minimal 当宿主跑一遍
pnpm guard:self                # 狗粮：门禁跑自己（library() 范式）
```

## 文档

- [`PARADIGM.md`](./PARADIGM.md) —— **通用范式**：三条公理、十个检测原语（分类词汇）、五条设计律、目录契约、判定等级、适配器契约、scope 语义。可直接搬到别的仓库当规约。
- [`docs/DESIGN.md`](./docs/DESIGN.md) —— 怎么实现 + 还没做什么：引擎机制、规则清单、已知缺口。
- [`docs/ALTERNATIVES.md`](./docs/ALTERNATIVES.md) —— **替代组合与竞品盘点**：不装本门禁能覆盖多少（≈30/53）、FSD 场景怎么拼、我们立得住的是什么。
- [`docs/adr/`](./docs/adr/) —— 为什么这么设计（可判定性优先 / 适配器是数据 / 两类工程范式 / 只发 ESM / 白名单显式 / 原语是词汇）。

## Roadmap

- [x] 体积阈值默认 500 且可配（`overrides.thresholds`）
- [x] P0 骨架：配置 / 扫描 / 事实模型 / 图 / 适配器 / 能力协商 / 豁免通道 / scope / 自检
- [x] 结构域：角色表与目录契约（S00–S06、S09、S11–S16、S19–S23）——含**层序 / 组隔离 / 公开面**三条通用图规则
- [x] 设计系统域（D03–D08 / D10 / D10b / D11 / D16 / D17 / D21）：色值唯一出处 / 令牌闭合与死令牌 / 明暗双份 / 对比度基线 / storage key / vendor 边界与反向封闭 / 框架残留 / 样式落点 / CSS Module 契约 / 声明与事实对账
- [x] 文案域（C02–C07）：键存在 / 多语言一致 / 一文件一命名空间 / 分片聚合 / 死键 / 声明与资源对账
- [x] 依赖域（P01 · P02 · P04–P07 · P11）：登记白名单 / 禁用库 / 适配表与实际依赖一致 / 图标来源唯一 / 能力必须用登记方案 / 疑似自造轮子（P03 幽灵依赖、P08 声明但未使用按 §4.9 委派给 knip · depcheck；P09 并入 P06）
- [x] 反退化域（H06）：脱离上下文的全局 API（H01–H05 委派给 eslint）
- [x] 度量域（M02–M09）：覆盖率棘轮、变更必须被覆盖、产物不得过期
- [x] 共 **56 条规则**（结构 S · 设计 D · 文案 C · 依赖 P · 退化 H · 度量 M；以 `--stats` 为准），**56/56 有夹具**（夹具全部 `exact`：多报也报错）
- [x] **与 lint 生态不交叉**：单文件语法卫生、颜色/`!important`/数值白名单、幽灵依赖、
      文案键存在性等全部**委派**给 eslint / oxlint / stylelint / knip（见 `docs/DESIGN.md` 的「委派清单」）
- [x] **可替换面**：UI 组件库（`ui-kit`）与 i18n（`i18n-kits`）建成适配器；结构声明化为数据（`canonical` / `library` / `fsd` 三范式 + `stack()` 组合）
- [ ] `--verify-deps` 的**联网成熟度**查询（本地对账已是默认能力）
- [ ] 其余 T1 适配器：数据层 / 路由 / 样式（`presets/{data-layers,routers,styles}/`）
- [ ] 文档管理块渲染（`--render-docs` / `--check-docs`）
- [ ] Vue / Svelte 框架包（pack 边界已留出）

## 许可

MIT
