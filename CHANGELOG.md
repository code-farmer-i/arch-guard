# Changelog

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 与语义化版本。

## [Unreleased]

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
- CLI/扩展：`--format=github`（CI 注解）、`--stats`（规则耗时与命中）、`--verify-deps`（适配表对账）、
  `definePack()`（包定义契约）、config/baseline 的 `specVersion` 校验。
- **修复：根 tsconfig 只有 `references` 时别名解析失败**（Vite 官方模板形态）→ 图解析全空，
  S15 会把整个项目误报成孤儿、图规则集体失明。现在顺着 references 链取 `paths`。

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

### Changed（与 lint 生态不交叉）

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

### Fixed

- **`--scope=changed/staged` 在软链路径下会假绿**：变更路径换算没做 realpath，macOS 的 `/var`↔`/private/var`
  （以及任何软链）会让路径与文件对不上，`active` 直接变空 —— 增量门禁将永远通过。现在两侧先 realpath。
- **CLI 通过软链路径调用时静默什么都不做**：直接调用判定用字面路径比较，`/tmp`→`/private/tmp` 之类会不相等，
  于是 CLI 打印空、退出 0（比报错更糟）。改为 realpath 比较。
- **`loadBaseline` 把 specVersion 错误吞成「基线文件无法解析」**：版本检查移出 try，报错才可执行。
- `i18n` 计算属性名（`[key]`）带方括号；`ts-api` 的版本读取改为可注入（异常分支可测）。

### Tests（第二轮）

- 测试 88 → **112 项**，覆盖率 → **98.84% 行 / 93.61% 分支 / 98.09% 函数**（无文件低于 90% 行）。
- 新增：预设参数分支、规则空项目健壮性（62 条全部安静通过）、规则早退分支、引擎边界
  （tsconfig references、baseUrl、损坏基线、git scope 三种模式、CLI 失败分支）。
- **测试缝**：`run(argv, { packageRoot })` 与 `createProgram(version)` 可注入，CLI 失败分支得以同进程覆盖
  （spawn 子进程的执行不会被父进程覆盖率统计合并）。

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

### Changed

- **D 域在 superhive 实测与旧 `check-theme` 结论一致**（0 条），旧脚本标记 `@deprecated` 并写明退役条件。
- `designSystem()` 的对比度基线默认**留空**：token 名是项目专有数据，预设不替项目做决定。

### Fixed（第三轮：审计修正）

- **`C02` / `C06` 恢复实现**：`t()` 的键存在性与死键检查回到本体，上面「删除 `C02`（键存在）、`C06`（死键）」
  那一条随之作废。删除理由写的是「`eslint-plugin-i18next` 能覆盖」，但实测该插件只有 `no-literal-string`
  一条规则（`Object.keys(plugin.rules)`），`no-missing-keys` / `no-unused-keys` 根本不存在 ——
  于是键拼错（界面直接显示键名）与死键成了没人守的两件事。
- 文档同步更正：`docs/ECOSYSTEM-AUDIT.md` §1 / §4（补一行 C02 / C06 的交叉判定）、
  `docs/DESIGN.md` §4.9（C01 的委派对象只有 `no-literal-string`）与 §14（D / C 域的落地状态）。
- `library()` 预设去掉指向已删除规则的 `H02`，自身 `pnpm guard:self` 不再报「配置里启用了不存在的规则」。
- 规则总数 46 → **48**（C02 / C06 回归）；上面几处「精简到 42 / 44 条」是更早的旧账，实际以 `--stats` 为准。

## [0.1.0] - 2026-09-23

### Changed

- **`docs/SPEC.md` → `docs/DESIGN.md`**：按 `docs/agents/issue-tracker.md` 的约定，`spec.md` 这个名字**只给 `.scratch/<feature-slug>/spec.md`**（特性规格，做完归档）；持久的设计参考文档改名 `DESIGN.md`，并在规范文件里写明「哪些不是 spec」，避免下次再被占用。

- **体积阈值默认 400/320 → 500**（`fileLines` / `viewLines`），仍可按项目覆盖：`overrides.thresholds`。
- **`docs/DESIGN.md` 瘦身 1185 → 719 行**：规范类章节（原 §2/§3/§4/§7.5）改为指向 `PARADIGM.md` 避免两处真相；状态类章节（原 §8/§9/§10/§11/§13/§15：交付物 / superhive 落地 / 分期 / 验收 / 待拍板 / 归属抽取）删除——状态归 README + CHANGELOG；原 §14「架构自审 18 项」收敛为「已知缺口（未实现）」清单。

### Added

- **测试补齐到 94% 行覆盖**（起点 83%）：新增 `tests/engine-{unit,facts,graph,runtime,report}.test.mjs`（纯函数 / 事实模型 / 依赖图 / 配置 / 报告 / run 路径 / CLI），并把「每条已实现规则必须有违规夹具」写成契约测试。`pnpm coverage` 用 Node 内置覆盖率。
- **新增 `__fixtures__/rules`**：补上此前无夹具的 S02（目录深度）、S16（体积）、H02（suppression）、H05（空 catch），以及 H01（非空断言 / `@ts-expect-error`）、H03（debugger / alert）、H04（占位字符串）、S12/S13（hooks / model 导出形态）的缺失分支。

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

### Changed（与 lint 生态不交叉）

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

### Fixed

- **`--scope=changed/staged` 在软链路径下会假绿**：变更路径换算没做 realpath，macOS 的 `/var`↔`/private/var`
  （以及任何软链）会让路径与文件对不上，`active` 直接变空 —— 增量门禁将永远通过。现在两侧先 realpath。
- **CLI 通过软链路径调用时静默什么都不做**：直接调用判定用字面路径比较，`/tmp`→`/private/tmp` 之类会不相等，
  于是 CLI 打印空、退出 0（比报错更糟）。改为 realpath 比较。
- **`loadBaseline` 把 specVersion 错误吞成「基线文件无法解析」**：版本检查移出 try，报错才可执行。
- `i18n` 计算属性名（`[key]`）带方括号；`ts-api` 的版本读取改为可注入（异常分支可测）。

### Tests（第二轮）

- 测试 88 → **112 项**，覆盖率 → **98.84% 行 / 93.61% 分支 / 98.09% 函数**（无文件低于 90% 行）。
- 新增：预设参数分支、规则空项目健壮性（62 条全部安静通过）、规则早退分支、引擎边界
  （tsconfig references、baseUrl、损坏基线、git scope 三种模式、CLI 失败分支）。
- **测试缝**：`run(argv, { packageRoot })` 与 `createProgram(version)` 可注入，CLI 失败分支得以同进程覆盖
  （spawn 子进程的执行不会被父进程覆盖率统计合并）。

- **`typescript@7` 下必崩**：TS 7 是原生重写，JS 侧不再暴露 `createSourceFile` / `ScriptKind`，而我们 的 peer 范围 `>=5.4.0` 放行了它 —— 用户装到 TS 7 会在 `ts.ScriptKind.TS` 上抛 `undefined`。现在：peer 收紧为 `>=5.4.0 <7`，并在加载时 fail-fast 给出可执行报错（"请安装 typescript@6"）。由发布验收中的真实消费方安装暴露。
- **发布产物带开发机绝对路径**：`sourcemap: true` 让 `.js.map` 里写进 `/Users/...`。关掉 sourcemap，包体 112K → 56K。

### Changed

- **删除冗余的 `deny` 默认值**：白名单（`allow`）一旦启用，未登记依赖已被 P01 拦下，黑名单只是第二份要同步的名册；预设不再替项目做选型决定（`deps()` 默认 `allow: [] / deny: []`）。本体自己的配置也删掉 `deny`。

- **依赖图解析不到 `.js` 指向 `.ts` 的导入**（TS nodenext 写法）—— 我们自己的源码正是这种写法，等于依赖图对本仓库是空的，S15/S08 一旦实现就会静默失效。
- **空块内的注释漏采**（`catch { /* 忽略 */ }`）—— H05「空 catch 是否写明理由」的判据因此失效；改用 TS scanner 采集全部注释 trivia。
- **裸调用（`alert` / `confirm` / `prompt`）没进事实模型** —— H03 只记录了带 `.` 的调用，这三类调试残留抓不到。

- **能力指纹判定改为按文件**：按全项目判会放过「部分迁移」（一个文件用了 dayjs、另一个还在手搓）；现在命中的文件必须自己 import 登记方案，正确封装在别处的文件不会被误报。
- **datetime 强指纹补齐**：`toISOString().slice`、`getFullYear/getMonth/getDate/getHours/getMinutes`、`Date.now() ± 毫秒` 等常见手搓形态；每文件报首个命中行并标注「另有 N 处」。
- **依赖域规则（P01/P02/P03/P06/P08）落地**：登记白名单（fail-closed）、禁用库、幽灵依赖（排除 Node 内置）、能力必须用登记方案（强指纹 + 全项目 import 判定 + 平台内置识别 + `allowOwn` 降级）、登记方案未被使用。指纹匹配前遮罩注释；无 `package.json` 的项目整体跳过依赖类规则；`deny` 与能力首选的冲突在启动时报错。

- **引擎骨架（P0）**：配置加载（预设合并 + tsconfig 别名单一出处）、目录扫描与角色表（互斥完备自检）、TS 事实模型（parser-only，规则不接触 AST）、import 图（含动态 import 与 CSS `@import`/`composes`）、能力协商注册表、棘轮基线（行文本哈希锚点）、报告（pretty / json）、检测范围 scope（full / changed / staged / since）。
- **规则**：结构域 S00–S16（解析失败 fail-closed、目录契约、深度、相对越级、barrel、命名、导出形态、域路由必填、体积），反退化域 H01–H05（类型逃生舱、suppression、调试残留、未完成标记、吞异常）；共 14 条。
- **适配器**：`defineAdapter` 字段白名单与样例校验、UI 组件库适配器（`antdKit` / `noneKit`）、组件库指纹数据（换库残留验收）。
- **本体自包含检查**：P1 依赖白名单 / P2 宿主字面量 / P3 引擎无布局假设（`--self-check-portability`）。
- **夹具回归**：`--self-test`，三个夹具（合规零误报 / 10 条违规全报 / 坏语法 fail-closed）。
- **构建与发布链路**：`pagoda-cli build`（lib 模式、保留模块结构）→ `es/` ESM + `.d.ts`，`private: false` 可发布形态；ESM-only（CJS 产物的相对路径与 `.js` 规范不兼容，见 docs/DESIGN.md）。
- **库 / CLI 范式**：`presets/library.ts`（库角色表 + 库适用规则集），本体用自己跑狗粮（`pnpm guard:self`）；据此修正三处规则精度（H04 字符串判据收紧、S11 放行 `export type *`、hygiene 不再抢规则选择权）并让配置豁免在报告里可见。
- **选型纪律（设计）**：`data/wheel-fingerprints.ts`（能力表 + 强/弱指纹 + 库 API 名），PARADIGM §12 / SPEC §16。
- **文档**：`PARADIGM.md`（通用范式，可整篇搬到别的仓库）、`docs/DESIGN.md`（完整设计与架构自审）、`README.md`。
