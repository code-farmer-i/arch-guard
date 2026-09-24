# Changelog

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 与语义化版本。

## [Unreleased]

### Fixed（scope 的安全语义：承诺了却没实现的那两条）

- **`--scope=staged` 现在真的读 index 内容**（`git show :<path>`），不再读工作区文件。这是 pre-commit 的经典 bug：
  用户 `git add` 之后继续改文件时，工作区是"下一版"、index 才是"这次要提交的" —— 旧实现会报出用户没打算提交的改动
  （假红，hook 被绕过），也会漏掉 index 里的违规（假绿）。取不到 index blob 的（staged 删除 / git 报错）退回工作区内容，
  并在报告里明列文件名 —— 不许静默换语义。新增 `tests/scope-safety.test.mjs`（index 干净 × 工作区违规、反向两组对照）。
- **`--local-only` 跳过的全局违规条数必须可见**：以前只是把不可归属的全局违规从报告里滤掉，摘要仍旧显示"全局违规 0"
  （DESIGN §6.8 退出码表要求"零，但打印跳过条数"）。现在 notice、摘要行、`RunResult.skippedGlobals` 与 JSON 报告
  四处都给出条数；默认行为不变（全局违规仍然失败）。
- 文档/实现对齐（本仓自己的公理 1：真相唯一）：`--staged` 的语义、P07 的实现状态（已落地，此前三处文档写"未实现"）、
  `--verify-deps`（本地对账已落地 / 联网成熟度未实现）、facts 缓存键（`rel + role + 内容 sha1`，不含"配置哈希/规则集版本"，
  因为 facts 与规则无关）、§6.2 目录树（`src/**/*.ts`，不再写已不存在的 `tools/arch-guard/*.mjs`）、§1.2 依赖口径
  （改为"显式登记的审查门"，与 `commander` + P1 白名单一致）、README 的四条不变式（补 P4）与 Roadmap。
  另修 §7.0.1 里与下一节自相矛盾的一条（库范式"走三根兜底"的旧口径：现在**没有兜底**，缺落点即明列停用）。

### Changed（真相收敛）

- **阈值与命名契约只剩一份默认值**（`src/engine/defaults.ts`）：此前 `config.ts` 的兜底、`canonical()`、`library()` 各写一遍
  （`hygiene()` 里还有第四份 `functionLines: 150`），改一处另外几处静默漂移。现在三者都从同一处取，行为不变；
  `tests/presets.test.mjs` 加了一条守卫（三个范文的阈值/命名必须等于唯一默认值）。
- **删掉死字段 `Config.addRoles`**：它被赋值却无人读（`roles` 已含追加结果），留着就是同一事实的第二处存放、
  将来谁读了就会把角色重复计入。`addRoles` 仍然可以作为宿主的 `overrides` / 预设输入使用（新增 `ConfigOverrides` 类型承载它）。
- `--verify-deps` 的输出不再暗示"依赖成熟度已把关"；PARADIGM §12.5 / DESIGN §16.4 标注联网部分未实现。

### Changed（狗粮配置：只留真有消费者的轴）

- **`arch.config.mjs` 去掉 `hygiene()`**：它只贡献 H06，而 H06 需要 `uiKit.detachedApis` 能力 ——
  本项目永远不会用组件库，所以那是一条**净贡献 0、永远停用**的声明（实测：去掉它启用规则数不变）。
  H 域在本仓靠 eslint 那侧覆盖（H01–H05 按 §4.9 委派）。**这是取舍不是缺陷**：想让"H 域评估过"留在报告里，加回一行即可。
- **`arch.config.mjs` 补 `metrics()`**：M 域（8 条规则）此前一条都没在本仓跑过。现在装两条**没有产物依赖**的：
  `tests.checkChain` → **M09**（`check` 链路必须真的包含 test 与 coverage —— 门禁自己漏跑只有门禁自己能查）、
  `depsBudget.runtime: 1` → **M07**（本体只许一个运行时依赖；加第二个要改配置，diff 可见）。
  实测狗粮从 15/55 → **17/55**，新增两条今天就是绿的，且都真的会失败（把 `pnpm test` 从 check 里摘掉 → M09 立即报错）。
  依赖覆盖率产物的 M02–M06 与 M08 仍是**明列停用**：M06 要求产物比 HEAD 新，装上会让 `pnpm guard:self`
  变成"必须先跑覆盖率"；M08 要求源文件被测试 import 或同名配对，而本仓测试是**分组测试 + 跑构建产物**（import `es/`），
  实测会一次报 24 条结构性 error（不是代码问题），装上等于削弱门禁。
- `arch.config.mjs` 另补：`specVersion: '1'`（配置格式版本不一致时显式报错）、`packs: [...]` 显式声明（不再依赖 CLI 兜底包）、
  `.scratch/**` 进 `ignore`（一次性 spike 不属于项目源码树）。
  注：写 `packs` 的收益是"配置自述用了哪种源码形态"，**不是**"让 facet 白名单校验生效" ——
  那条校验一直通过 CLI 兜底包在跑（`loadConfig` 见到 pack 就校验），此处更正我先前的说法。

### Changed（pack 轴：`framework` 指源码形态，不是"用了哪个框架"）

- **新增 `tsPack`（`framework: 'typescript'`），本仓改用它。** 起因是一个纯 TS 库/CLI 竟被 `reactPack` 量：
  根因是 v1 只有一个叫 "react" 的包，而它实际承载的是「TS/TSX parser + 全部规则」——
  `framework` 只驱动两件事（哪些扩展名归本包管、S20 的报错文案），**没有任何规则按它分支**（已核对）。
  现在：`src/packs/core/rules/` 存放**共享规则实现**，`packs/typescript` 与 `packs/react` 是两份 pack 声明，
  今天引用同一份 `coreRules`（v1 没有任何 JSX 专属的**已实现**规则：C01 / D15 已委派）；
  JSX 专属规则落地时它们的家是 `packs/react/rules/`，那时两者才真正分化。
- **引擎默认源码形态从 `react` 改为 `typescript`**（`framework-sources.ts` 里第一个已实现项）：
  引擎不该假设前端框架。扩展名集合两者相同，所以行为零变化，只有标签与 S20 文案跟着变。
- 公共 API：`reactRules` → **`coreRules`**（从 `arch-guard` 与 `arch-guard/packs/core` 导出）；
  新增 `tsPack`。CLI 的兜底包**仍保持 `reactPack`** —— 忘了写 `packs` 的 React 宿主（会配 `uiKit`）不静默变红。
- 文档同步：PARADIGM §11（pack = 源码形态 + 两者今天共用规则集）、DESIGN §6.2 目录树 / §7.1 源码形态轴 / §7.5 pack 职责、
  CONTEXT 的 pack 词条、README 配置示例、AGENTS 目录表；新增 `tests/packs.test.mjs` 钉住
  「默认形态不是 react / 两包规则集一致 / packs 与 metaFramework 一处真相」。

### Added（可判定性的锚点写清）

- `docs/adr/0006-primitives-are-vocabulary.md`：十个检测原语是**分类词汇**，不是引擎里的一层（实现里没有 primitives 模块）。
  可机检的锚点是「`createRule()` 契约 + 每条规则的夹具对」；PARADIGM §3.1、CONTEXT.md、DESIGN §6.7 同步写明。
- **`tests/preset-matrix.test.mjs`：把 DESIGN §7.0.1 的「96 种组合穷举」从"手工跑过一次"变成回归保护。**
  逐条断言组合语义本身：`enable` 是各贡献者的**并集**（任取 'all' 则整体 'all'，且 32 个域子集必须给出 32 份不同规则集
  —— 谁都不能被顶掉）、`structure` 是**加法**、`roles`/`layout` 来自范式（域预设不许动）、
  落点**随范式**且域预设只写显式给的、同一预设写两遍幂等、范式两两混用 fail-closed、`disable` 在 registry 侧真的做减法。
- README「质量保障」补 P4 自检与 `pnpm check` 的实际链路；`/coverage.txt` 移出版本控制并加进 `.gitignore`
  （它是本地日志，README 的测试数/覆盖率数字跟着它一起过期过）。

### Changed（原子化收尾：落点不兜底、死参数删除、`all` 语义写清）

- **D 域落点不再兜底三根路径**：`designParams()` 只认项目/范式声明过的落点，依赖落点的 8 条规则
  （D03 / D06 / D07 / D08 / D10 / D10b / D16 / D21）改成 `requires: ['designSystem.<字段>']` —— 缺落点则**明列停用**。
  实测：`library() + designSystem()`（不声明落点）→ `因能力未声明而停用 8 条规则：D03 / D06 / D07 / D08 / D10 / D10b / D16 / D21`；
  以前它们会悄悄去量 `src/shared/styles`（只有 D21 的"零匹配"警告算线索）。
- **删掉三个没有消费者的参数**：`spacing` / `lengthProps` / `allowLengthValues` —— 它们是"魔法数字三族"（D12–D14）的输入，
  而那几条已委派 stylelint / eslint。实现时按 `requires: ['designSystem.<字段>']` 加回。
- **`enable: 'all'` 的语义写清并加测试**：它是"该 pack 的全部规则"（应用范式 `canonical()` 的有意默认）；
  收窄用 `disable`（减法），`overrides.enable` 是**整体替换** —— 三条都有单测钉住。
- 文档：DESIGN §7.0 组合语义表补 `all` 说明 + 新增「落点不设兜底默认」一条。

### Added（组合方案 `stack()`：原子预设 + 一层不含硬编码的糖）

- 新增 **`stack(options)`**：把域预设按需装配成 `presets: [范式(), ...stack({ … })]`。三条约束写进实现与文档：
  ① **不含任何硬编码**（组件库 / i18n 方案 / 语言 / 白名单 / 落点全部由选项传入，不传就用"声明空能力"的
  `noneKit()` / `noneI18nKit()` → 对应规则**明列停用**）；② **不引入新语义**（只是拼
  `designSystem()`/`copy()`/`deps()`/`hygiene()`/`i18n()`/`uiKit()`/`metrics()`，用户可以不要它、手写同样几行）；
  ③ **范式仍只有一个**（`stack()` 只管正交的域轴）。
- 顺手修掉一个语义 bug：`noneI18nKit()`（"项目不用 i18n"）以前也会被范式的 `params.i18nDir` 补上落点，
  于是 C 域照跑、C07 还会误报"声明了 i18n 却零资源"。现在**只在适配器声明了 i18n 库（`from` 非空）时才补落点**。
- 拆出 `presets/kit.ts`（`uiKit()` / `i18n()`），避免 `stack()` 与 `presets/index.ts` 循环依赖。
- 测试：`tests/stack.test.mjs`（6 条）—— 默认空能力 · 选项驱动 · 落点仍随范式 · 组合 = 各域并集 ·
  `hygiene: false` 与 `metrics` 按选项生效 · "不用 stack 手写同样几行结果一致"。
- 文档：README 配置模板换成 `...stack({ … })`；DESIGN §7 增「组合方案」小节；ALTERNATIVES §3.5 配方改用 `stack()`。

### Added（P4 自检：库名只许出现在数据表与适配器面）

- **兑现 docs/DESIGN.md §7.3 早就写下的承诺**：`engine/**`、`packs/**` 与通用预设（`presets/*.ts`）不得出现已登记库名，
  违反即门禁自身报错。`portability.ts` 以前只有 P1/P2/P3，所以库名可以随便躺在引擎里。
- 名单**不新增第二份**：从允许位置（`data/*` 与 `presets/<面>/*`）按约定登记（`from` / `packages` / `preferred` 数组，
  或常量名含 `Packages`/`Kits`/`Names`）**自己长出来** —— 新增 kit 自动纳入扫描。
- 只收**包名形状**的名字（`@scope/x`、含 `-`/`.`）：纯单词库名（`antd`、`bootstrap`）与项目里的槽位名无法区分
  （`canonical.ts` 的 `slot: 'bootstrap'` 就是误报来源），收了就是误报 —— 这条限制写进 hint 与 §6.7。
- 实测：往通用预设里注入 `from: ['react-i18next']` → `[P4] 库名只许出现在 presets/<面>/* 与 data/*：react-i18next`；撤销即恢复通过。

### Changed（库名归位：data 表 + 适配器面；i18n 拆成 kit；死声明清理）

- **`i18n` 适配器从通用预设里搬走**：`copy()` 现在**只贡献 C 域规则集**（不再内联 i18next 适配器、不再收 `resourceDir`/`languages`/`fn`/`hook`）。
  能力改由 `i18n(i18nextKit({…}))` / `i18n(noneI18nKit())` 提供 —— 与 `uiKit(adapter)` 完全同形，
  库名只出现在新的 `presets/i18n-kits/*`。修掉的旧后果：`--verify-deps` 拿 `from: ['i18next','react-i18next']`
  对账 package.json，项目换了 i18n 方案却还留着 `copy()` 就误报"声明了 i18next 却没装"。
- **引擎/框架包里的库名归位到数据表**：`engine/deps-audit.ts` 的 `KNOWN_KITS` 删除，改用既有的
  `data/kit-fingerprints.ts`（本来就是同一份数据的第二真相）；`packs/.../deps-adapters.ts` 的硬编码图标名单
  移到 `data/icon-packages.ts`。
- **删掉 `tokenPrefix`**：它没有任何消费者（D02/D18 未实现），而且是**宿主 superhive 的前缀**做通用/引擎默认 ——
  正是 P2 要防的那类宿主字面量。实现 D02/D18 时以 `designSystem({ tokenPrefix })` + 参数型能力加回
  （`registry` 新增参数型能力根：`designSystem.x` 读 `config.params.x`，缺它则规则**明列停用**）。
- **死声明清理**（按"声明必须有消费者"）：
  - 三个**零消费者** facet（`router` / `data-layer` / `styles`）从 `FACET_FIELDS` 与 `CAPABILITY_ROOTS` 删除；
  - `ui-kit` 的 `styleProps` / `policy` /（此前）`themeIntegration` 三个字段删除；
  - **`Pack.adapters` 从死声明变成 fail-closed 校验**：宿主配的 facet 必须被该 pack 支持，否则报错；
    react pack 的清单同时修正为 `['ui-kit','i18n','metrics']`（原来列了 3 个没人读的，反而漏了 metrics）。
- 测试/夹具同步：`tests/preset-compose.test.mjs` 的 i18n 用例改按新语义（`copy()` 不带适配器时**没有能力**、
  由范式补落点）、能力守卫表改成"谁负责**启用**规则"（`copy()` 而不是 kit）、`declared-gap` 夹具补上 i18next 依赖
  （P04 现在也拿 `from` 对账）。

### Changed（C 域预设**保持叫 `copy()`**：不加 `i18n()` 别名，改为让后果可见）

- 用户反馈"看到 `copy()` 想不到这是 i18n"。按设计逐条推：**预设名 = 域名 = 概念名**（域表是 S 结构 / D 设计系统 /
  **C 文案** / P 依赖 / H 反退化 / M 度量，只有 C、M 有同名预设）；`i18n` 是**机制名**（还绑 i18next），
  与"工具可替换、概念名优先"的取向冲突；而 `i18n = copy` 这种**别名让同一个东西有两个名字** ——
  正是这轮刚清掉的"第二份真相"（`config.layers` / `themeIntegration` / `languages`）。**所以不改名、不加别名。**
- 改成**让后果可见**：`copy({ languages })` 以前**没人读**（语言集合由磁盘扫描得出），
  "声明了 en 却没有 `en/`"完全无声 —— 而缺的那门语言在界面上会直接显示键名。现在 **C07** 增加第二个分支：
  **声明的语言必须有资源**（声明 ⇄ 事实，与 D21 / P11 同一形状）；总资源为零时仍只报一条（不往 C03 灌噪音）。
- 新增夹具 `__fixtures__/copy-langs` → 夹具回归 **27/27**；README 配置模板加了「预设 → 概念」目录；
  DESIGN §5.3 标明"copy = 文案，不是复制"。

### Docs（组合矩阵：96 种穷举实测）

- DESIGN 新增 §7.0.1：3 范式 × 5 域预设全部子集（96 种）**真实加载**的结果 ——
  单范式 + 任意域预设 **96/96 合法**；任取两范式 **3/3 被守卫拦下**；重复写同一预设幂等；
  域预设全开时落点仍随范式（`canonical` → `shared/styles`，`fsd` → `shared/ui/styles`）。
  另记三个"不是错误但要知道"的点：逐键覆盖类字段**顺序敏感**、库范式不声明契约落点（无能力则 skipped 明列）、
  `overrides` 是整体替换而预设之间是并集。

### Added（预设组合语义：范式唯一 + 落点跟范式 + `addRoles` 追加）

- **范式唯一性守卫（fail-closed）**：`presets` 里出现两个范式预设（如 `[canonical(), fsd()]`）→ `loadConfig` 直接报错并指路。
  以前是**静默错误组合**（实测：角色表取后者 36 条、`layout` 逐键混成库范式的空根、`structure` 取并集 → 门禁在量一个不存在的目录）。
- **契约落点改由范式声明**：`canonical()` 声明三根落点、`fsd()` 声明 FSD 落点（`src/shared/ui/styles/…`），
  `designSystem()` **只写用户显式给的路径**（不再塞三根默认值）。于是 `[fsd(), designSystem()]` 开箱就用 FSD 目录，
  以前会被悄悄改回 `src/shared/styles`（实测）。谁都没声明时仍由 `designParams()` 内置默认兜底 —— 与旧版行为一致。
  落点也跟着 `src` 走：`canonical({ src: 'app-src' })` → `app-src/shared/styles`。
- **`addRoles`（追加角色）**：项目在所选规范之外还有自己的目录（`src/legacy/**`）时，
  用 `overrides: { addRoles: [...] }` 追加即可，不必整份重写角色表（那样范式一升级就漂）。`roles` 仍是整体替换。
- 新增 `tests/preset-compose.test.mjs`（4 条）：范式唯一性 · 落点随范式 · 落点随 `src` · `addRoles` 追加与替换的分界。
- 文档：DESIGN 新增 §7.0「预设的组合语义」表（每个字段的合并规则）；PARADIGM §6.6 补一句；ALTERNATIVES §3.5 配方简化为
  `fsd() + designSystem()`（不再手写 6 条路径）。

### Fixed（i18n 落点也跟范式走：`copy()` 不再写死 `src/shared/i18n/locales`）

- `copy()` 以前把 `resourceDir` 写死成 `src/shared/i18n/locales` —— 与 `designSystem()` 塞三根默认值是同一类毛病：
  `canonical({ src: 'app-src' })` 时 i18n 目录**不跟着 src 走**。
- 修法：范式声明 `params.i18nDir`（`canonical()` / `fsd()` → `${src}/shared/i18n/locales`），`copy()` **只写显式给的** `resourceDir`，
  并在 `loadConfig` **一处补齐**（适配器没写就用 `params.i18nDir`）—— 能力判定 / i18n 索引 / 报告都只认一个完整的适配器。
- 库范式不声明 i18n 落点：`[library(), copy()]` 时适配器没有 `resourceDir` → C 域**因能力未声明而停用**（fail-closed 且可见），
  要跑就显式给 `copy({ resourceDir })`。
- 测试：`tests/preset-compose.test.mjs` 增 1 条（三根 / 自定义 `src` / FSD / 显式优先 / 库范式无能力 五种情形）；
  `tests/engine-report.test.mjs` 里那条"默认值"断言改成新语义（默认落点由范式给）。

### Fixed（`fsd()` 默认片段里有两个"按内容命名"的名字）

- 按社区官方 linter 的 [`segments-by-purpose`](https://github.com/feature-sliced/steiger/tree/master/packages/steiger-plugin-fsd/src/segments-by-purpose) 黑名单核对，
  `fsd()` 的默认片段里有**两个不合规**：`shared/assets` 与 `app/providers`（名单里明确列了 `assets` 与 React 的 `providers`）。
  默认值改成合规集 —— shared：`ui/lib/api/config/i18n`；app：`router/styles/i18n`。
- 需要这两个名字就显式加（一行）：`fsd({ sharedSegments: [...默认, 'assets'] })` / `fsd({ appSegments: [...默认, 'providers'] })`；
  这是**有意的摩擦**：默认值不该替项目"洗白"一个会被社区 linter 判为按内容命名的片段。
- 顺带记录一条容易误判的结论：**`styles` 不在黑名单里 → `shared/styles` 合规**（黑名单是穷举式，未列即允许）。
  文档：ALTERNATIVES §3.5 新增「片段名字要过 `segments-by-purpose`」小节（含完整词表与三种写法）。

### Removed（适配器里没人读的 `themeIntegration` 字段）

- **删掉 `uiKit` 适配器的 `themeIntegration` 字段**：它只在 schema 白名单与两个 kit 里出现，**没有任何规则读它**，
  而 DESIGN §7.1 的适配器契约表却写着它驱动 "exclusiveOwner（S03 落点 + D10 边界）" —— 文档在承诺一个不存在的判定。
- 更根本的理由：**第三方覆盖的落点与主题集成文件是项目决定，不是组件库事实**（同一个项目换库不该改变目录）。
  它由 `designSystem({ vendorDir, themeFile, ... })` 与目录规范声明，只有一处真相。
- ⚠️ 破坏性（fail-closed，不静默）：自定义 kit 若还写着 `themeIntegration`，`defineAdapter` 会因未知字段直接报错，
  删掉该字段即可。DESIGN §7.1 表格行与 §7.4 示例同步删除。
- 与 `uiKit()` 的 enable 修复同源：**每条声明都必须有消费者**（`config.layers` 那次的教训）。

### Fixed（`uiKit()` 只给数据不启用规则 → 适配器静默失效）

- **实测的静默失效**：`presets: [fsd(), uiKit(antdKit())]` 时 `.ant-btn` 出现在 vendor 之外**不报** ——
  `uiKit()` 只注册适配器，而读它的 5 条规则（`uiKit.vendorSelectors` → D10/D10b · `uiKit.icons` → P05 ·
  `uiKit.packages` → P11 · `uiKit.detachedApis` → H06）没被任何预设启用（`fsd()`/`library()` 的 enable 是白名单）。
  加上 `designSystem()` 才报 —— 说明这是"谁声明域、谁顺带启用"的偶然，不是设计。
- **修法**：`uiKit()` 声明自己贡献的规则集（与域预设同一套"声明即启用"语义，取并集）；是否真的跑仍由**能力协商**决定。
  修复后同一配置 13 → **18 条规则**，D10 正常报出。
- **新增通用守卫测试**「能力提供者必须启用消费它的规则」：遍历所有带 `requires` 的规则，断言提供该能力的预设
  （`copy()` / `metrics()` / `uiKit()`）确实启用了它 —— 这类"装了适配器却没人读"的漏洞以后会被测试拦住。

### Added（`fsd()` 预设：FSD 从 38 行角色表变成一行）

- 新增 **`fsd()`**：把 Feature-Sliced Design 的三层模型全部落成**数据** ——
  层 → `layer` 层号 · 切片 → `group: 'slice'` · 片段 → **封闭枚举** · 公开面（切片根 `index.ts`）→ `entry: true`；
  三条结构规矩由通用规则判：`structure: { order: true, isolate: ['slice'], publicApi: ['slice'] }` → **S21 / S22 / S23**。
  **引擎里没有一行 FSD 字面量** —— 换范式只是换预设那一行。
- 选项：`src` / `slicedLayers` / `appLayer` / `sharedLayer` / `segments` / `sharedSegments` / `appSegments`，
  以及 `slicesGrouped`（分组切片 `features/auth/login/...`）。**分组必须显式打开**：两种形态无法用一组 glob 同时表达
  （`{group}/{slice}/{seg}` 会把不分组的路径也匹配上 → 角色歧义）。
- **决策反转并记录**：结构声明化之前定的"不内置 FSD 预设"是错的 —— 预设层本来就是**规范的家**（`canonical()` 也是规范），
  让每个宿主手抄 38 行角色表才是重复劳动；引擎的零方法论字面量由 P2/P3 自检保证。
- 夹具 [`__fixtures__/fsd-preset`](./__fixtures__/fsd-preset)：一份完整 FSD 项目（合规文件 + 四类违规）→ 夹具回归 **26/26**；
  预设结构测试进 `tests/presets.test.mjs`。
- 文档：ALTERNATIVES §3.5 改成"FSD 就这么配"（原手写配方收进 `<details>`）；DESIGN §7 预设列表与 PARADIGM §6.6 同步。

### Docs（口径修正：不再把 steiger 当 FSD 的必经之路）

- [ALTERNATIVES.md](./docs/ALTERNATIVES.md) §3.3 加前置说明：结构声明化落地后**我们自己就能表达 FSD**（S21/S22/S23），
  这一节只适用于**已经在用 steiger** 的宿主；新项目走 §3.5 的声明配方即可，不必引入第二个工具。
  （原先"结构归 steiger"的前提是"我们不管目录规范"，该前提已被结构声明化推翻。）

### Changed（层序只剩一套机制：`canonical()` 也走通用规则，S07 删除）

- **`canonical()` 现在声明 `structure: { order: true }`** —— 应用范式的层序改由通用的 **S21** 判定，
  原先 shared 专属的 **S07 删除**（规则 56 → **55**，`__fixtures__/graph` 的两条期望随之改为 S21）。
- **顺带补上一个真实漏洞**：S07 只管 shared 内部，所以 `shared → modules`（低层依赖高层）与 `modules → app`
  这两类向上依赖**以前没人管**；S21 判的是"只许依赖层号 ≤ 自己的文件"，把它们一并抓住。
- **不重复报**：S21 只在 `to.layer > from.layer` 时触发，而 S05/S06（域间，同层）与 S09（layouts → modules，向下）
  都在别的方向上，所以一条边仍只被一条规则报。
- 域与装配层的**关系**（域间只能经 routes、layouts 不许引域、有 views 必有 routes）仍归 S04–S09/S14 ——
  那些不是层序，声明表达不了。
- ⚠️ **迁移提示**：宿主基线里若有 `S07` 条目，会作为「过期条目」被棘轮提示删除（可见，不静默）。

### Added（结构声明化：目录规范变成宿主可声明的数据，S22/S23）

- **`StructureSpec` 三个字段，各有一条规则消费**（不做"声明了没人读"的配置 —— `config.layers` 那次的教训）：
  - `structure.order: true` → **S21 层序单向**（门控从"猜 `layout` 是否为空"改成**读声明**）；
  - `structure.isolate: ['slice']` → **S22 组隔离**：同组维度、同层、不同组之间不许互相引用；
  - `structure.publicApi: ['slice']` → **S23 公开面**：组必须有入口文件，且组外不许直接引用组内非入口文件。
- **组与入口都是角色表里的数据**：`{ pattern: 'src/pages/{slice}/ui/**', layer: 5, group: 'slice' }` 声明组维度，
  `entry: true` 标记入口（三根是 `routes.tsx`、FSD 是 `index.ts`）—— **规则不认识任何具体文件名**，引擎里没有方法论字面量。
- **引擎**：`FileRecord` 新增 `captures`（全部 `{name}` 捕获）/`group`（组值）/`groupName`（维度名）；
  `RoleDescriptor` 新增 `group` / `entry`；`Preset.structure` 与 `overrides.structure` 之间**加法合并**；
  S21–S23 抽到 `src/packs/react/rules/structure-declared.ts`（"声明驱动"一组）。
- **"目录枚举"这个原定缺口被设计消解**：组由文件派生（没文件的目录不构成组），"组缺入口"用文件集就能判 —— 少一处引擎改动。
- **验收**：夹具 `structure-isolate`（S22）与 `structure-public-api`（S23，顺带覆盖 `{slice}` + `{segment}` 多捕获）→ 夹具回归 **25/25**；
  新增单测「同一份引擎换范式」：用 `atoms/molecules/organisms` 三个**声明**层跑 S21，违规必报且**引擎零改动**。
- **文档**：DESIGN 新增 §6.2.1 结构声明、§5.1 加 S22/S23、§7 示例补 `structure`（并修正 `copy` 参数名）；
  PARADIGM 新增 §6.6「结构声明：范式是可换的数据」（含 L1–L3 硬边界）；ALTERNATIVES §8 标为**已实现**；
  规格 `.scratch/structure-as-data/spec.md`（done）。规则总数 54 → **56**。

### Added（S21 分层单向：`library({ modules })` 的层号不再只是声明）

- **新增 `S21`**：只许依赖**层号 ≤ 自己**的文件（`to.layer > from.layer` 即报）。
  它是 `library({ modules: { data: 1, engine: 2 } })` 里那些数字的**唯一用途** ——
  在此之前层号被写进 `record.layer` 却没有任何规则读它（唯一的消费者 S07 是 shared 专属，
  而库范式把 `layout.shared` 置空 → 恒不生效）。实测证据：**把层号倒过来，输出一模一样**。
- **自带一道门**：`layout.modules` / `layout.shared` 非空时（应用范式）直接跳过 ——
  应用范式的层序已由 S07（shared 线性层序）+ S04–S09（域/装配层）负责，不重复报同一条边。
- 哨兵层（`test` = 99）跳过：测试可以引用任何东西，不算"向上依赖"。
- 文档补了「用现有能力定义 FSD」的实测（[ALTERNATIVES.md](./docs/ALTERNATIVES.md) §3.5）：27 条角色描述符能钉住层封闭枚举 + 片段封闭枚举 + 层序；
  同层切片互不引用与公开面定义不了（根因：`{slice}` 捕获被丢 + 缺公开面规则）。
- 新增夹具 `layer-order`（`exact: true`：low(1) 引 high(2) → 恰好一条 S21）+ 门控单测；
  `library()` 的 enable 列表加入 `S21`。

### Fixed（`enable` 取并集 + `disable` 减法：预设组合不再静默关域）

- **`enable` 从"后者覆盖前者"改成"并集"**：多个预设各自声明自己贡献哪几条规则，组合是加法。
  旧行为的真实后果：`library({ modules }) + designSystem() + copy() + deps()` 只启用 **10/53** 条 ——
  D/C/M 域被静默关掉，宿主必须手抄一份 40 个 id 的并集才跑得起来（FSD 配方就是这么被逼出来的）。
- **各域预设补上"贡献声明"**：`designSystem()` → D 12 条 · `copy()` → C 6 条 · `deps()` → P 7 条 ·
  `metrics()` → M 8 条 · `hygiene()` → H06；`canonical()` 显式声明 `enable: 'all'`（应用范式默认全开）。
  并新增守卫测试：每个域预设的 enable 列表必须**等于**该域已实现的规则集，防止"加了规则没挂进预设"。
- **新增 `disable`**（预设与 `overrides` 都取并集）：`enable` 求完之后再减 —— 例如 FSD 宿主想保留具名导出时
  `overrides: { disable: ['S11'] }`。
- `overrides.enable` 语义不变：仍是"我全都要自己定"的整体替换开关。
- 文档同步：[ALTERNATIVES.md](./docs/ALTERNATIVES.md) §3.3 的 FSD 配方去掉了 40 个 id 的并集、§3.4 的阻塞点标为已修；
  PARADIGM §11.1 补上"预设各贡献规则集并取并集"的语义。

### Docs（"兼容所有规范的引擎"先例调研）

- [ALTERNATIVES.md](./docs/ALTERNATIVES.md) §8 补上先例：这类引擎在 **ArchUnit（Java）/ import-linter（Python）/
  go-arch-lint（Go）/ Nx tags（JS monorepo）** 早有成熟实现，且抽象出的都是同一个形状（映射 / 关系 / 层序 / 公开面）——
  也就是 §8 的四个字段。JS/TS 侧只有"半个"（`@boundaries/elements` 99 万/周、`dependency-cruiser` 287 万/周、
  `eslint-plugin-project-structure` 4.9 万/周），`archlint` 已停更。
- 记下硬边界与可验收定义：**只能兼容规范的可判定部分（L1–L3）**；验收 = 同一份引擎用三份声明表达
  三根 / FSD / Atomic Design 且夹具各自通过、引擎零改动。

### Docs（steiger + 我们的实测配方）

- [ALTERNATIVES.md](./docs/ALTERNATIVES.md) §3.3/§3.4 换成**实测通过的配置**：依赖安装（npm 只装 steiger；pnpm 必须显式装
  `@feature-sliced/steiger-plugin`）、`steiger.config.mjs`（`.js` 且无 `type: module` 会报 `Failed to load the ES module`）、
  我们这侧的 `library({ modules: 六层, entry: [] })` + 契约预设 + `disable: ['S21']`。
- 记录一条方法论纠正：**steiger 在场时不要用 27 条细粒度角色表**（会与 `segments-by-purpose` / `public-api` 重复报），
  粗粒度六层足够 —— 我们只兜"层外文件"与跨文件契约。
- 实测分工：steiger 14 条（层序/跨切片/公开面/死切片/片段命名）vs 我们 10 条（层外文件 + 死令牌 + 文案 + 依赖），**零重叠**；
  其中 `src/utils.ts`（层外文件）**steiger 零命中**，只有 S01 抓得住。

### Added（`docs/ALTERNATIVES.md`：替代组合与竞品盘点）

- 新增一份整体版生态审计（[ECOSYSTEM-AUDIT](./docs/ECOSYSTEM-AUDIT.md) 的补充）：
  逐条列出我们的判据在生态里谁在做（含周下载量）、**拼一套成熟组合能覆盖 ≈30/53 条**、
  以及**任何组合都补不上的七项**（跨文件令牌图 / 跨语言一致 / 声明⇄事实 / 依赖选型体系 / 统一棘轮 / 判定纪律 / CSS Module 契约）。
- 收录实测证据：steiger 在非 FSD 项目上给 **`✔ No problems found!`（静默假绿，退出码 0）**，同一个工具在 FSD 项目上报 10 条；
  eslint 的 suppressions 是 `文件+规则→计数`（**按计数不按行**，修一处可在别处加一处），与我们的行文本锚点形成实质差别。
- 收录 FSD 场景的完整配方（路径约定表、`steiger.config.js`、`library({ modules: 六层, entry: [] })` + 契约预设、四个坑），
  以及「结构声明化」方向草案（`structure: { order, isolate, publicApi, slots }` + 四条方法无关的通用规则）。
- 已知阻塞点也写进去了：**`enable` 是覆盖不是并集** —— 不写并集时 `library()` 的白名单会把 D/C/M 域静默关掉（实测 10/53）。

### Changed（依赖政策：P1 从"零依赖洁癖"改成"审查门"）

- **"整目录可搬"不再是发布形态**（本包以 npm 包发布），所以 P1 的理由改成真实的那个：
  门禁读全量源码、跑在 CI —— **新增依赖要有理由，且不得把宿主拖进版本冲突**。
  要加依赖：改 `ALLOWED_BARE_IMPORTS` + `package.json` + CHANGELOG，P1 的报错话术同步改成「依赖没登记」。
- **P2 / P3 保留**，但把理由写对：它们与发布方式无关 —— P2 是「换宿主不改引擎」，P3 是「引擎不假设布局」
  （`canonical` / `library` / 自定义目录全靠它，今天刚靠它抓到 `rootsOf` 写死 `src/modules` 的假绿）。
- README「本体自包含（可抽取）」→「**引擎不绑宿主**」；`CONTEXT.md`、`DESIGN` §0/§6.1.1/§7.1/§7.4 的措辞同步校正。

### Fixed（`globToRegExp` 花括号里的点号没转义）

- `{index.ts,cli.ts}` 会被编译成 `(?:index.ts|cli.ts)` —— 里面的 `.` 是**任意字符**，
  能匹配到 `indexXts`。现在花括号分支逐个转义正则元字符（`{ts,tsx}` 这类无点号的写法不受影响），并加测试锁住。
  之前 `library()` 的入口就是绕开了这个写法才没踩到。

### Added（oxc spike：结论是**不换 parser**）

- 量了（[.scratch/oxc-spike/](./.scratch/oxc-spike/spec.md)，脚本可重跑）：真实规模 3044 文件 / 9.8 MB 下，
  `oxc.parseSync` 比 `ts.createSourceFile` 快 **2.2×**（511ms vs 1133ms）—— 但**解析只占 extractFacts 的 32%**，
  换 parser 的端到端上界只有 **≈17%**；26k 小文件上更是 **≈1%**（每文件开销主导）。
- **真正的大头是我们自己的访问器 + 注释扫描（2.4s / 3.6s = 67%）**，换 parser 还要把这段在 oxc 的 AST 上重写一遍，
  外加 native 多平台二进制与缓存键变更。所以 `DESIGN` §6.1.1 的 oxc 行改成「可再评估」并指向 spike 结论。
- 力气挪到自有代码：注释扫描按需、`containsJsx` 自底向上标记、主循环按 `node.kind` 分派（见 spike 的「下一步」）。

### Changed（canonical 对齐：删死配置、提示指路、跨域组合拍板）

- **删掉 `layers`**（`Preset.layers` / `Config.layers` / `canonical()` 里那 12 行）：全仓没有任何规则读它 ——
  S07 用的是角色描述符上的 `record.layer`。留着就是第二个层号真相 + 一个没人读的配置面。
- **删掉 DESIGN §7 示例里的 `semanticSlots`**：消费它的 D20 从未实现，示例却把它写得像可用配置。
- **S01 / S03 的提示改成「指路」**：按文件位置直接念出落点表 —— `app/providers.tsx` → 「装配套壳写进 App.tsx，
  配置对象下沉 shared/」，`modules/<域>/types.ts` → 「域根只放 routes.tsx，类型与常量进 model/」，
  没登记的槽位 → 念出域内七个槽位，`shared/components/Button.tsx` → 「进 ui/ 或 common/」。
  闭集枚举只说"你错了"没用，迁移中的人（或 agent）要知道"放哪"。
- **R1 拍板（方案 c）**：跨域组合一律**提升**到 `shared/components/common`（业务中立组合件）或
  `shared/api`（数据契约），由 `app` 层组合；域间直连继续红（S04–S06）。
  被否的替代：给域开第二个公开面 `index.ts` —— 深模块会变成两个出口。已写进 PARADIGM §6.3，DESIGN §14 的 R1 标为已拍板。

### Fixed（layout 是唯一真相：自定义目录不再假绿）

- **`canonical({ modules, shared })` 之前是假旋钮**：角色表跟着参数变了（S01 不再报"无处安放"），
  但 S04–S09 / S15 / S18 / S03 还写死查 `${srcRoot}/modules` 与 `${srcRoot}/shared` ——
  查一个不存在的目录 → 静默空转 → 跨域引用私有 views **一条都不报**，门禁显示"通过"。
  实测 A/B：同一份违规，目录叫 `src/modules` 报 S05+S06，配置成 `src/features` 时零报告。
  现在这四处（`structure-graph.ts` 的 `rootsOf`、`structure.ts` 的 S03 / S01 域根豁免）一律读 `config.layout`。
- 新增夹具 `canonical-layout`（`exact: true`）：自定义 `modules: 'src/features'` 下，跨域引用必须报 S04/S05/S06。

### Changed（`library()` 变成真正通用的库范式）

- **角色表参数化**：`library({ modules: { utils: 1, core: 2 }, entry: ['index.ts'] })` ——
  库的结构就是「公开面入口 + 项目自己声明的目录表」。旧版把**本体的目录名写死**在预设里
  （`engine/` `packs/` `presets/` `data/`、入口写死 `cli.ts`、ignore 里一串宿主文件），
  任何第三方库用它都会得到一片 S01（实测：普通库的 `src/utils/`、`src/core/`、`src/types.ts` 全报）。
- **`layout.modules` / `.shared` 置空**表示「库没有域与共享层这两个应用概念」——
  依赖它们的图规则因此自然空转，而不是去查一个不存在的目录假装检查过。
- 内部目录角色**不设 `slot`**：目录名恰好叫 `lib` / `hooks` 时不会误套应用范式的槽位语义（S12/S13 会误判）。
- 宿主专有的 ignore（`es/**`、`examples/**`、`__fixtures__/**`、`pagoda.config.mjs` …）从预设移出，
  本仓库在 `arch.config.mjs` 里显式声明 —— `ignore`（别碰）与 `include`（不判契约但仍解析）是两件事，
  只靠 `include` 会让这些文件照样被解析（实测狗粮 71 → 340 个文件）。
- 新增夹具 `library-generic`（`exact: true`）：一个普通第三方库形态的 `src/index.ts` + `src/utils/` + `src/core/`，零发现项。

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
