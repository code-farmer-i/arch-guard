# Changelog

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 与语义化版本。

## [Unreleased]

### Added（P11：组件库适配表声明了却零使用）

- **`P11`**：声明了 `uiKit(antdKit())`，但项目里既没 import 它声明的任何包、也没有任何 vendor 选择器/变量
  → warn。此时 D10 / D10b / P05 / H06 全在空转，门禁却显示"通过"。
  与 P04 的分工：**P04 管「声明了要装、装了要登记」（清单一致性，error）；P11 管「装了要真的用得上」（事实存在性，warn）**。
  `uiKit(none())`（`packages: []`）能力不存在 → 规则不注册，不会给不用组件库的项目添噪音。
- `declared-gap` 夹具扩成三面齐活：`copy()` 零资源 + `designSystem()` 零路径 + `uiKit()` 零使用 → 恰好三条 warn。

### Added（C07 / D21：声明了能力面却零事实，不再静默空转）

- **`C07`**：加了 `copy()` 但 `resourceDir` 下一个文案文件都没有 → warn。
  能力协商只保证「**没声明**就不注册」；声明了却没有对应事实时，C02–C06 会安静地遍历空集合、
  门禁显示"通过" —— 这正是「以为在跑、其实没跑」。
- **`D21`**：加了 `designSystem()` 但 `paletteFile` / `tokenDir` 零匹配 → warn。
  靠 `params.designSystemDeclared` 显式标记把「没声明设计系统」（应当安静）与「声明的路径写歪了」
  （必须报）分开 —— `designParams()` 带内置默认路径，光看参数分不出来。
- 新增夹具 `declared-gap`（`exact: true`）：两处路径都指空，恰好两条 warn。
- 顺带澄清：**`P03` / `P08` 按 DESIGN §4.9 委派给 knip · depcheck，本体不实现** ——
  `__fixtures__/deps` 的 `enable` 里还点着它们、README 与 DESIGN §16.5 说它们"已落地"，都已改正。

### Fixed（`designSystem()` 的配置根本没生效）

- **`designParams()` 只展开 `DEFAULTS`，从未把宿主的参数盖上去**，于是 `tokenPrefix` / `spacing` /
  `styleDir` / `tokenDir` / `vendorDir` / `paletteFile` / `themeFile` / `storageFile` 八个字段的配置
  **全部被静默忽略**：D03 这类规则照默认路径找不到文件，就静默 `return []`，门禁还显示"通过"。
  现在逐字段解析（可配清单在代码里可见），并把不相关的 `params` 键挡在 `DesignParams` 之外。
  这是 D21 能报出正确路径的前提。

### Added（facts 持久缓存：重复运行 ≈5×）

- 新增 `src/engine/facts-cache.ts`：把每个文件的解析结果（facts）按 **rel + role + 内容 sha1** 缓存到磁盘，
  下一轮没变的文件直接读缓存、不再解析。整份缓存的键是 `FACTS_CACHE_SPEC` + TypeScript 版本 ——
  事实模型或解析器换了就整体作废。图与全局谓词**不在缓存里**，每轮照旧从 facts 重建（保住「scope 只过滤报告」的语义）。
- **实测**（3043 个 ts 文件 / 21.5 万行）：冷跑 5.88s → 热跑 **1.22s（4.8×）**；
  26k 个**小**文件仓库 4.0s → 3.1s（−23%，文件越小解析越便宜，缓存能省的自然越少）。
- **缓存写在哪**：跟 Vite 同一策略 —— 有 `node_modules` 就写 `node_modules/.arch-guard-cache/facts.json.gz`
  （天然被 git 忽略、`rm -rf node_modules` 顺手带走），没有 `node_modules`（PnP / monorepo 子包）则退回项目根 `.arch-guard-cache/`。
- 每次运行自述**命中数与路径**；`--no-cache` 关掉；缓存损坏 / 版本不符 → 整份作废并说明原因；
  写不进去（只读盘、权限）只提示、不影响判定 —— 缓存是加速手段，不是正确性依赖。
- 7 条测试锁住：全命中、**改内容必重算（防假绿）**、role 变化重算、损坏与版本不符作废、
  `--no-cache`、`node_modules` 位置、落盘内容带 spec + ts 版本。

### Changed（框架包接进配置：规则集不再硬编码）

- **`arch.config.mjs` 支持 `packs: [reactPack]`**：规则集由框架包给出，`cli.ts` 不再硬编码 `reactRules`，
  只提供**兜底包**（引擎不认识任何 pack —— 依赖方向是 pack → 引擎）。
- **`Pack` 新增必填 `framework`**：它实现哪个元框架。于是 `metaFramework` 与 pack 不再可能各写一份：
  配了包就以包为准；两边都写且不一致直接报错。这消掉了上一版刚引入的「两处真相」。
- **一个项目只允许一个包**：换元框架是换 parser 与整套规则集，不是叠加；多包直接报错并指向 DESIGN §7.5。
- **没有任何包又没有 rules 时明确报错**，而不是「跑 0 条规则 → ✔ 通过」。
- `runGuard` 的 `rules` 变为可选（程序化调用/单测显式给规则集的路径不变），新增 `fallbackPacks`。

### Added（`metaFramework` + S20：非 React 项目不再假绿）

- **新增配置轴 `metaFramework`**（默认 `react`），取值表在 `src/data/framework-sources.ts`（纯数据，引擎里不出现框架名）。
  认不出的取值、或**还没有 pack** 的框架（`vue` / `svelte` / `astro`）一律 fail-closed 报错。
- **为什么这是红线**：`.vue` / `.svelte` 本来根本不在扫描扩展名里（`walk` 只收 ts/tsx/js/jsx/mjs/cjs + css/scss/less + json/html），
  于是拿 Vue 项目跑会得到「扫到 0 个文件 → **✔ 架构守卫通过**」—— 一行都没查还说通过了，正是本工具最反对的假绿。
- **新增规则 `S20`（框架包必须覆盖项目的源码形态）**：项目里混进当前 pack 量不了的源码即报，
  并列出 `扩展名 × 个数`。这些文件不会混进文件集参与图判定。
- 新增夹具 `framework-gap`（`exact: true`：一个 canonical 工程 + 一个 `.vue` 页面 → 恰好一条 S20）。
- 顺手补回 `__fixtures__/clean/src/shared/lib/format.ts`：`clean` 夹具的 `CrewsPage.tsx` 一直在 import 它，
  但文件同样被 `.gitignore` 吞掉，留下一个悬空引用（不报错、所以没人发现）。

### Added（S19 导出宽度与单文件组件数）

- **新增 `S19`**：单文件导出值 > `exportsPerFile`（默认 6）或单文件组件数 > `componentsPerFile`（默认 3）即报。
  「导出值」不计类型导出（类型是契约，不是宽度）。
- **只属于应用范式**：`canonical()` 默认开（`enable: 'all'`）；`library()` 的启用名单里没有它 ——
  库的入口 `src/index.ts` 就是公开面，导出几十个符号是正确形态（实测：按 error 直接落到库里会先把狗粮自己打红 9 个文件）。
  这是 ADR-0003「规则集必须跟着工程类型走」的又一次应用。
- 新增夹具 `width`（`exact: true`）：`shared/lib/many.ts` 7 个导出值、`shared/components/ui/Multi.tsx` 4 个组件，
  两个文件都接进可达图以免顺带触发 S15。
- 顺手修文档漂移：`DESIGN.md` §5.1 那句「已实现并带夹具的规则：…H01–H05」早已不准，
  改为以 `reactRules` 为准的 49 条清单，并写明 `S08` / `S10` / `P03` / `P08` 是**委派**而非漏实现。

### Changed（删掉没人读的配置旋钮）

- **删掉 `naming.pageComponentSuffix`**：全仓 grep 没有任何规则读它（`hookPrefix` / `viewSuffix` 有），
  属于「以为在管、其实没管」的假旋钮。`Thresholds.exportsPerFile` / `componentsPerFile` 这次补上了实现（见 S19）。

### Changed（范式补一条：全局 Provider 装配放哪）

- `PARADIGM.md` §6.4 唯一落点表新增两行，并把 React 习惯的 `app/providers.tsx` 写进反例表：
  **套壳写进 `app/App.tsx`，provider 的配置对象各自回家**（queryClient→`shared/api`、theme→`shared/theme`、
  i18n→`shared/i18n`、store→`shared/stores`）。
  不为此给角色表开通用口子 —— app 层仍是封闭枚举，`App.tsx` 只留几十行嵌套，也撞不到 S16 的 500 行。

### Added（契约扫描域 `include`）· 行为变更

- **新增 `include`**（配置根相对的 glob 列表，[规格](./.scratch/include-scope/spec.md)）：只有命中它的 ts/css 参与角色判定与逐文件规则。
  域外的 `vite.config.ts` / `e2e/` / `scripts/` / 生成代码**不再被报「不在目录契约内」**。
  实测把 2 万个生成文件放进项目：**20000 条 error → 0**。
- **`canonical()` / `library()` 默认 `include = [<srcRoot>/**]`**（行为变更：域外文件不再进 `missing`）。
  `overrides.include` 可覆盖，空数组 = 不限制（引擎默认）。报告摘要与 notice 会自述扫描域与域外文件数，不静默。
- 域外文件**照常解析**（角色记为 `(outside)`）：import 边与「测试是独立可达根」都靠 facts，
  少了它们，只被域外测试引用的 src 文件会被误判成孤儿（S15）。这条是夹具当场抓出来的。
- `M08`（该有测试的文件）改从**完整文件集**找测试文件：测试常放在契约域之外（`tests/`），
  它们没有角色、不进 `records`，但「有没有测试」必须看得见。
- 新增夹具 `include-scope`（默认域外不报，`exact: true` 锁零发现项）与 `include-custom`（`overrides.include` 把 `scripts/**` 纳回契约 → 重新报 S01）。

### Changed（性能：解析热路径瘦身，实测 −20%）

基准：`canonical() + hygiene()` 合成宿主，3043 个 ts 文件 / 21.5 万行，全量运行。

- **`createSourceFile` 改用 `setParentNodes: false`**（`docs/DESIGN.md` §6.1.1 本来就写的是 false，代码写成了 true）。
  只有 3 处需要父节点（字符串字面量的上下文、`prop` 名、箭头函数的变量名），改为在遍历时**显式传参**，
  不再让 TS 给每个节点都挂父指针。累计 **5.75s → 4.63s**。
- **删掉 5 组零消费者的 facts 字段**：`jsxText` / `catches` / `inlineStyles` / `anyNodes` / `nonNull`。
  对应的 H01（`any` / 非空断言）、H05（空 catch）、D15（内联样式）、C01（JSX 裸文本）早已
  [委派给 eslint 并从规则集删除](./docs/ECOSYSTEM-AUDIT.md)，收集代码却留了下来 —— 每次全量解析都在为没人读的字段付钱。
  `Facts` 类型与 `__fixtures__` 的断言同步收缩，并在 `extractFacts` 上写明「加字段前先确认有规则在读」。
- 两部分合计 **5.75s → 4.63s（−20%）**，峰值内存 277MB → 264MB。

### Fixed

- **没有 git 时不再把 git 自己的报错透传到用户屏幕**（`致命错误：不是 git 仓库…`）：`execFileSync` 的 stderr 默认透传，
  而三处 git 调用本来就 `catch` 掉走「明确降级」分支。改为 `stdio: ['ignore','pipe','ignore']`；
  另外 `headTimeMs`（只有 M06 会读）改成**配了 metrics 适配器才算**，没配就不起子进程。
  测试输出里的该类噪音 14 处 → 0。
- **`.gitignore` 的 `lib/` / `es/` 未锚定仓库根**，把 `__fixtures__/*/src/shared/lib/**` 一并吞掉：
  夹具文件从来没进过 git，干净克隆下 6 个夹具缺文件、自检与 2 个测试恒失败。已改为 `/lib/` `/es/`，
  并**补齐了全部 14 个缺失文件**（见下）。`pnpm self-test` 恢复 **17/17**，测试 **131 通过 / 0 失败**。
- **`M02` 的发现项改用配置根相对路径**（原来是覆盖率产物的绝对路径 `report.path`，与 M06 不一致）：
  绝对路径写进报告与棘轮基线后，换机器/换 CI 必然对不上 —— 这是真·假红来源。
  夹具里那两处机器相关数据（`coverage-summary.json` 的键、`expect.json` 里 M02 的 `file`）同步改成相对路径。
- `tests/fixtures.test.mjs` 读的是不存在的 `item.reason`（`runSelfTest` 给的字段是 `message`），
  导致夹具失败原因一直打印成 `undefined` —— 夹具回归红的时候看不见为什么红。

### 补齐的夹具（曾被 `.gitignore` 吞掉，按 `expect.json` 的期望重建）

`violations` / `adapters` / `graph` / `hygiene-context` / `rules` / `coverage` 六组共 14 个文件：

| 夹具              | 补回的文件                                                    | 触发的规则      |
| ----------------- | ------------------------------------------------------------- | --------------- |
| `violations`      | `src/shared/lib/helpers.ts`（barrel + default 导出 + 孤儿）   | S11 / S13 / S15 |
| `adapters`        | `src/shared/lib/helpers.ts`（弱指纹 + `debounce` 命名指纹）   | P07 / S15       |
| `graph`           | `format.ts`（lib 反向依赖 api）、`leftover.ts`、`crewOnly.ts` | S07 / S15 / S18 |
| `hygiene-context` | `datetime.ts`、`fixtures.ts`、`timers.ts`（孤儿）             | S15             |
| `rules`           | `big.ts`（49 行 > 夹具阈值 40）                               | S16             |
| `coverage`        | `good.ts`、`bad.ts`、`zero.ts`                                | M02 / M03 / M08 |

> 这些文件是**按 `expect.json` 的期望反推重建**的，不是原作者的原始内容；原作者若手上有原件，可以直接覆盖比对。

## [0.2.3] - 2026-09-23

### Changed（依赖策略：能力表不再隐式开启 P01）· 行为变更

- **`deps({ capabilities })` 不再顺带打开 `P01` 依赖白名单**（[ADR-0005](./docs/adr/0005-allowlist-is-explicit.md)）。
  旧实现 `approved = allow ∪ capabilities.values` 以 `approved.size` 判空，于是「只限定日期格式化用 dayjs」
  写成 `deps({ capabilities: { datetime: 'dayjs' } })` 等价于宣布「批准清单里只有 dayjs」——其余运行时依赖全部报红。
  现在 `P01` 的开关是 `allow` 是否显式声明，能力表只驱动 `P06`。反重复不受影响：`policyConflicts` 仍要求
  `allow` 非空时能力首选必须登记在 `allow` 里。
- **批准名单的组成 = `allow ∪ 适配表声明的 packages`**：`uiKit(antdKit())` 这类适配器已经声明了「项目用什么库」
  （P04 读同一份数据），组件库不必在 `allow` 里重抄。适配表只**并入名单**，不打开 `P01` —— 开关仍然只有 `allow`。
- 不静默：`runGuard` 在「有 capabilities、无 allow」时打印 notice，说明 P01 未开启、如何显式开启。
  配置格式未变，故未 bump `CONFIG_SPEC_VERSION`。
- 夹具 `__fixtures__/declarations-only` 锁住「只写声明不开 P01（P06 必报 × P01 不报）」，
  `__fixtures__/allowlist-adapters` 锁住「适配表的包被批准（`exact: true`，多一条即失败）」。

## [0.2.2] - 2026-09-23

### Fixed（第三轮：审计修正）

- **`C02` / `C06` 恢复实现**：`t()` 的键存在性与死键检查回到本体，0.2.0 里「删除 `C02`（键存在）、`C06`（死键）」
  那一条随之作废。删除理由写的是「`eslint-plugin-i18next` 能覆盖」，但实测该插件只有 `no-literal-string`
  一条规则（`Object.keys(plugin.rules)`），`no-missing-keys` / `no-unused-keys` 根本不存在 ——
  于是键拼错（界面直接显示键名）与死键成了没人守的两件事。
- 文档同步更正：`docs/ECOSYSTEM-AUDIT.md` §1 / §4（补一行 C02 / C06 的交叉判定）、
  `docs/DESIGN.md` §4.9（C01 的委派对象只有 `no-literal-string`）与 §14（D / C 域的落地状态）。
- `library()` 预设去掉指向已删除规则的 `H02`，自身 `pnpm guard:self` 不再报「配置里启用了不存在的规则」。
- 规则总数 46 → **48**（C02 / C06 回归）；0.2.0 里几处「精简到 42 / 44 条」是更早的旧账，实际以 `--stats` 为准。

## [0.2.1] - 2026-09-23

### Fixed

- **`--paths` 接受绝对路径**（IDE / 编辑器插件按文件传参的形态）：之前只按配置根相对路径匹配，
  诊断工具传绝对路径时一条都匹配不上 → 门禁报「通过」但其实什么都没查（静默假绿）。
  新增 `rootRelativePattern()`：绝对路径 / 绝对 glob 归一到配置根相对（含 `/var` ↔ `/private/var` 软链写法差异），
  相对模式原样。
- **`--paths` 过滤掉全局违规时给出 notice**：`另有 N 条全局违规（架构级）被过滤，需全量运行才可见` ——
  否则「按文件跑」会让人以为架构级谓词也过了。

## [0.2.0] - 2026-09-23

### Added

- **design 域 12 条规则（D01–D11 + D10b）**：颜色唯一出处、色板只放色板令牌、色值唯一、令牌引用闭合、
  无死令牌、明暗双份齐全、对比度基线（WCAG + 半透明合成）、storage key 与 index.html 一致、禁 `!important`、
  组件库选择器只许在 vendor、vendor 目录反向封闭、无框架残留。
- **copy 域 C02–C06**：文案键必须存在、多语言键一致、一文件一命名空间、分片必须被聚合入口引用、无死键（warn）。
  C01（JSX 裸文案）委派给 `eslint-plugin-i18next` 的 `no-literal-string`。
- **CSS 结构化解析器**（`src/engine/css.ts`）：注释遮罩、块与选择器、自定义属性定义/引用、颜色求值与对比度。
- **i18n 资源索引**（`src/engine/i18n.ts`）：用 TS 解析器把 `locales/<lang>/<ns>.ts` 解析成键路径。
- `copy()` 预设改以 **i18n 适配器**声明能力（`requires: ['i18n.resourceDir']`），未声明时规则出现在 `skipped` 而不是静默失能。
- `CallFact` 增加 `stringArg` / `keyPrefix`（动态键 `t(\`ns.${x}\`)` 按静态前缀放行死键判定）。

- **structure 域补齐 S03–S09/S15/S17/S18**：域根只许 routes、域内 import 前缀白名单、跨域只经 routes、
  views 域外私有、shared 线性层序、全图无环、layouts 不 import modules、可达性三查（孤儿/routes 聚合/view 引用）、
  导出名查重、shared 单域使用。
- **design 域补齐 D12–D18**：魔法长度/层级/时长、内联样式纪律、样式落点、CSS Module 双向契约、只消费语义令牌。
- **deps 域补齐 P04/P05/P07**：适配表与实际依赖一致、图标来源唯一、弱指纹+命名指纹的疑似自造轮子。
- **hygiene 域补齐 H06–H10**：脱离上下文的全局 API、假异步与随机、硬编码地址、静默假数据、手搓时间格式化。
- **S02 目录深度上限可配**（`params.maxDepth`，默认 4）：范式自身的 `locales/<lang>/<ns>.ts` 就是 4 层，写死会误伤。
- CLI/扩展：`--format=github`（CI 注解）、`--stats`（规则耗时与命中）、`--verify-deps`（适配表对账）、
  `definePack()`（包定义契约）、config/baseline 的 `specVersion` 校验。
- **修复：根 tsconfig 只有 `references` 时别名解析失败**（Vite 官方模板形态）→ 图解析全空，
  S15 会把整个项目误报成孤儿、图规则集体失明。现在顺着 references 链取 `paths`。

### 审计：与 lint 生态的交叉（第二轮）

- 新增 `docs/ECOSYSTEM-AUDIT.md`：逐条判定 44 条规则的交叉情况（真独有 / 需重抄项目数据 / 与运行器阈值部分重叠），
  并给出可复现的核查命令（`npx oxlint --rules`、`builtinRules.has(...)`）。
- 按审计结论再删 4 条零数据重复：`H02`（→ `eslint-plugin-eslint-comments`）、`D15`（→ `no-magic-numbers` + 选择器）、
  `D02`/`D18`（→ stylelint）。
- 新增 **M 度量域**（M02/M03/M04/M06/M07）：读覆盖率产物与依赖计数，**门禁不跑测试**；
  `M06` 在产物缺失/过期时 fail-closed（这是没有工具做的那一环）。总阈值 M01 与体积预算 M08 故意不实现（vitest 阈值 / size-limit 已有）。
- 新增两条**测试治理**规则（现成工具没有的）：`M08` 测试↔源配对（静态判定「该有测试的地方有没有测试」）、
  `M09` 门禁链路自检（`check` 必须真的包含 test 与 coverage —— 本会话踩过的「覆盖率在跑但统计错了对象」）。
  测试专项审计见 `docs/ECOSYSTEM-AUDIT.md` §4.1。
- 引擎：`run.ts` 提前计算 scope 供 M05 复用、`ctx.metrics`/`ctx.git` 接入、`--coverage-report` 开关、
  `--update-baseline` 同时写覆盖率棘轮快照。

### Changed

- **从 62 条精简到 42 条**：把「重新实现 lint 已有能力」的规则全部删掉，并写清委派去处
  （`docs/DESIGN.md` §4.9 委派清单）。
  - 删除：`H01`（any/非空断言/ts 注释）、`H03`（console/debugger/alert）、`H04`（TODO）、`H05`（空 catch）、
    `H07`（假异步/随机）、`H08`（硬编码地址）、`H09`（假数据）、`S08`（依赖环）、`S10`（`../` 越级）、
    `P03`（幽灵依赖）、`P08`（登记未使用）、`D01`（颜色字面量）、`D09`（`!important`）、
    `D12/D13/D14`（魔法数字三族）、`C01`（裸文案）、`C02`（键存在）、`C06`（死键）。
  - 收窄：`S15` 去掉孤儿维度（交 dependency-cruiser）、`S16` 去掉行数维度（交 eslint max-lines）。
  - 保留的都是需要「角色表 / 适配器 / 能力表」的：角色表互斥完备、域边界与层序、路由聚合与 view 引用、
    令牌图与对比度、CSS Module 双向契约、多语言同构、能力指纹、批准清单策略等。
- **迁移约束到 lint**：本仓 `eslint.config.mjs` 承接 `no-empty`、`no-warning-comments`、
  `max-lines`(500)、`max-lines-per-function`(300)、以及原有的 any/非空断言/ts 注释/console；
  README 首段改为明确分工（本工具不是 linter）。
- **D 域在 superhive 实测与旧 `check-theme` 结论一致**（0 条），旧脚本标记 `@deprecated` 并写明退役条件。
- `designSystem()` 的对比度基线默认**留空**：token 名是项目专有数据，预设不替项目做决定。

### Fixed

- **`--scope=changed/staged` 在软链路径下会假绿**：变更路径换算没做 realpath，macOS 的 `/var`↔`/private/var`
  （以及任何软链）会让路径与文件对不上，`active` 直接变空 —— 增量门禁将永远通过。现在两侧先 realpath。
- **CLI 通过软链路径调用时静默什么都不做**：直接调用判定用字面路径比较，`/tmp`→`/private/tmp` 之类会不相等，
  于是 CLI 打印空、退出 0（比报错更糟）。改为 realpath 比较。
- **`loadBaseline` 把 specVersion 错误吞成「基线文件无法解析」**：版本检查移出 try，报错才可执行。
- `i18n` 计算属性名（`[key]`）带方括号；`ts-api` 的版本读取改为可注入（异常分支可测）。
- **基线同一行多条违规无法全部豁免**：`applyBaseline` 用消耗式匹配（`splice`），同一行上的第二条违规
  （例如 `style={{ flex: 1, minWidth: 0 }}` 报出的两条 D15）永远豁免不了，棘轮会一直在那几行报红。
  改为「按锚点匹配 + 标记已用」：锚点标识的是**行**，该行的所有违规一起豁免。
- `normalizeHex('#FFF')` 不展开缩写（没剥 `#`）；`color-mix` 只接受 `var()` 底，十六进制底解析不了。
- CSS 选择器与声明的行号系统性少 1（缓冲起点落在上一行结尾的换行上）。

### Tests

- 测试 69 → **88 项**，覆盖率 94.4%/87.8% → **97.64% 行 / 88.43% 分支 / 98.31% 函数**。
- 新增：`css`（解析器/颜色求值/对比度）、`i18n`（键路径与命名空间前缀）、`deps-audit`（适配表对账）、
  `cli-extra`（`--verify-deps`/`--format=github`/`--stats`/错误参数退出码）、`output`、
  以及把**夹具回归搬进测试进程**（此前 `pnpm coverage` 只跑单测，新规则的函数覆盖率显示为 0%）。
- 测试 88 → **112 项**，覆盖率 → **98.84% 行 / 93.61% 分支 / 98.09% 函数**（无文件低于 90% 行）。
- 新增：预设参数分支、规则空项目健壮性（62 条全部安静通过）、规则早退分支、引擎边界
  （tsconfig references、baseUrl、损坏基线、git scope 三种模式、CLI 失败分支）。
- **测试缝**：`run(argv, { packageRoot })` 与 `createProgram(version)` 可注入，CLI 失败分支得以同进程覆盖
  （spawn 子进程的执行不会被父进程覆盖率统计合并）。

## [0.1.4] - 2026-09-23

### Fixed

- **superhive 首次接入暴露的 3 个误报**：`S12` 不再管 views 下的样式文件与 api 的 camelCase、
  `S13` 放行 hook 的类型导出、`S14` 定位点优先取代码文件。
- **`S14` 定位点改为首个代码文件**：原来随文件遍历顺序漂移，同一违规的棘轮锚点会不稳定。

## [0.1.3] - 2026-09-23

### Fixed

- **`dependencies.commander` 被字段重排脚本吃掉**：由 CI 的 `frozen-lockfile` 拦下；
  补 manifest 防呆测试（`tests/engine-runtime.test.mjs`）—— 运行时依赖少一个，发布的包直接不可用。

### Changed

- **删除 GitHub 托管 CI**（`.github/workflows/ci.yml`）：门禁改为本地 `pnpm check`（谁提交谁在本地跑），
  `AGENTS.md` / `README.md` 同步说明。此前的 CI 迭代（矩阵 `fail-fast: false` + 超时 + 失败注解）随之移除。
- 补 `repository` / `homepage` / `bugs` 元数据；忽略并取消跟踪 npm pack 产物
  （`.gitignore` 只对新文件生效，已跟踪的 `.tgz` 要显式移除）。

## [0.1.0] - 2026-09-23

### Added

- **测试补齐到 94% 行覆盖**（起点 83%）：新增 `tests/engine-{unit,facts,graph,runtime,report}.test.mjs`（纯函数 / 事实模型 / 依赖图 / 配置 / 报告 / run 路径 / CLI），并把「每条已实现规则必须有违规夹具」写成契约测试。`pnpm coverage` 用 Node 内置覆盖率。
- **新增 `__fixtures__/rules`**：补上此前无夹具的 S02（目录深度）、S16（体积）、H02（suppression）、H05（空 catch），以及 H01（非空断言 / `@ts-expect-error`）、H03（debugger / alert）、H04（占位字符串）、S12/S13（hooks / model 导出形态）的缺失分支。
- **引擎骨架（P0）**：配置加载（预设合并 + tsconfig 别名单一出处）、目录扫描与角色表（互斥完备自检）、TS 事实模型（parser-only，规则不接触 AST）、import 图（含动态 import 与 CSS `@import`/`composes`）、能力协商注册表、棘轮基线（行文本哈希锚点）、报告（pretty / json）、检测范围 scope（full / changed / staged / since）。
- **规则**：结构域 S00–S16（解析失败 fail-closed、目录契约、深度、相对越级、barrel、命名、导出形态、域路由必填、体积），反退化域 H01–H05（类型逃生舱、suppression、调试残留、未完成标记、吞异常）；共 14 条。
- **依赖域规则（P01/P02/P03/P06/P08）落地**：登记白名单（fail-closed）、禁用库、幽灵依赖（排除 Node 内置）、能力必须用登记方案（强指纹 + 全项目 import 判定 + 平台内置识别 + `allowOwn` 降级）、登记方案未被使用。指纹匹配前遮罩注释；无 `package.json` 的项目整体跳过依赖类规则；`deny` 与能力首选的冲突在启动时报错。
- **适配器**：`defineAdapter` 字段白名单与样例校验、UI 组件库适配器（`antdKit` / `noneKit`）、组件库指纹数据（换库残留验收）。
- **本体自包含检查**：P1 依赖白名单 / P2 宿主字面量 / P3 引擎无布局假设（`--self-check-portability`）。
- **夹具回归**：`--self-test`，三个夹具（合规零误报 / 10 条违规全报 / 坏语法 fail-closed）。
- **构建与发布链路**：`pagoda-cli build`（lib 模式、保留模块结构）→ `es/` ESM + `.d.ts`，`private: false` 可发布形态；ESM-only（CJS 产物的相对路径与 `.js` 规范不兼容，见 docs/DESIGN.md）。
- **库 / CLI 范式**：`presets/library.ts`（库角色表 + 库适用规则集），本体用自己跑狗粮（`pnpm guard:self`）；据此修正三处规则精度（H04 字符串判据收紧、S11 放行 `export type *`、hygiene 不再抢规则选择权）并让配置豁免在报告里可见。
- **选型纪律（设计）**：`data/wheel-fingerprints.ts`（能力表 + 强/弱指纹 + 库 API 名），PARADIGM §12 / SPEC §16。
- **文档**：`PARADIGM.md`（通用范式，可整篇搬到别的仓库）、`docs/DESIGN.md`（完整设计与架构自审）、`README.md`。

### Changed

- **`docs/SPEC.md` → `docs/DESIGN.md`**：按 `docs/agents/issue-tracker.md` 的约定，`spec.md` 这个名字**只给 `.scratch/<feature-slug>/spec.md`**（特性规格，做完归档）；持久的设计参考文档改名 `DESIGN.md`，并在规范文件里写明「哪些不是 spec」，避免下次再被占用。
- **体积阈值默认 400/320 → 500**（`fileLines` / `viewLines`），仍可按项目覆盖：`overrides.thresholds`。
- **`docs/DESIGN.md` 瘦身 1185 → 719 行**：规范类章节（原 §2/§3/§4/§7.5）改为指向 `PARADIGM.md` 避免两处真相；状态类章节（原 §8/§9/§10/§11/§13/§15：交付物 / superhive 落地 / 分期 / 验收 / 待拍板 / 归属抽取）删除——状态归 README + CHANGELOG；原 §14「架构自审 18 项」收敛为「已知缺口（未实现）」清单。
- **能力指纹判定改为按文件**：按全项目判会放过「部分迁移」（一个文件用了 dayjs、另一个还在手搓）；现在命中的文件必须自己 import 登记方案，正确封装在别处的文件不会被误报。
- **datetime 强指纹补齐**：`toISOString().slice`、`getFullYear/getMonth/getDate/getHours/getMinutes`、`Date.now() ± 毫秒` 等常见手搓形态；每文件报首个命中行并标注「另有 N 处」。
- **删除冗余的 `deny` 默认值**：白名单（`allow`）一旦启用，未登记依赖已被 P01 拦下，黑名单只是第二份要同步的名册；预设不再替项目做选型决定（`deps()` 默认 `allow: [] / deny: []`）。本体自己的配置也删掉 `deny`。

### Fixed

- **`typescript@7` 下必崩**：TS 7 是原生重写，JS 侧不再暴露 `createSourceFile` / `ScriptKind`，而我们的 peer 范围 `>=5.4.0` 放行了它 —— 用户装到 TS 7 会在 `ts.ScriptKind.TS` 上抛 `undefined`。现在：peer 收紧为 `>=5.4.0 <7`，并在加载时 fail-fast 给出可执行报错（"请安装 typescript@6"）。由发布验收中的真实消费方安装暴露。
- **发布产物带开发机绝对路径**：`sourcemap: true` 让 `.js.map` 里写进 `/Users/...`。关掉 sourcemap，包体 112K → 56K。
- **依赖图解析不到 `.js` 指向 `.ts` 的导入**（TS nodenext 写法）—— 我们自己的源码正是这种写法，等于依赖图对本仓库是空的，S15/S08 一旦实现就会静默失效。
- **空块内的注释漏采**（`catch { /* 忽略 */ }`）—— H05「空 catch 是否写明理由」的判据因此失效；改用 TS scanner 采集全部注释 trivia。
- **裸调用（`alert` / `confirm` / `prompt`）没进事实模型** —— H03 只记录了带 `.` 的调用，这三类调试残留抓不到。
