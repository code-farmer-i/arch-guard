# 把本会话的工作移植到上游（upstream port）

Status: done

## 背景与问题

本会话的全部工作是在**过期检出**上做的：本地从 `4bff252` 分叉，而 `origin/main` 已经走了 31 个提交（到 `v0.3.8`）。
上游期间改变了三件会互相打脸的事：

1. **基线机制被移除**（`722ad85`）→ 改为零容忍 + 覆盖率棘轮；豁免改成**规则级例外**（`d26b12c`）。
2. **pack 布局重构**（`90bfaa9`）：规则实现统一搬到 `src/packs/core/rules/**`，`typescript` / `react` 只是两份 pack 声明。
3. **报告契约化**（`72a2355` / `3b140fe`）：`notices` 变成 `{ code, text }`，code 清单是**对外契约**（`src/engine/codes.ts`）。

本地那 4 个提交已保底在分支 `wip/steiger-parity-2026-09-24`（`5de7ad3`）；`main` 已 `reset --hard origin/main`。

## 目标

把 `wip` 里仍然成立的工作**逐条移植**到上游基线之上：每步 `pnpm check` 绿了再提交，不引入与上游重复或相反的口径。

## 非目标

- 不把 `wip` 整支合并（会留下两套 `packs/*/rules` 树，且 S24 撞号）。
- 不复活任何基线相关的东西。
- 不把本地那份过期文档搬过来（上游文本已大幅变化）——文档在上游当前文本上**增量重写**。

## 已定案的取舍

| 冲突                                                               | 决定                                                                         |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| 规则号撞车：本地 `S24` = 组必须有片段，上游 `S24` = 契约扫描域非空 | 本地那条**重编号为 `S35`**（上游 S25–S34 都空着，本地 S25–S34 原样保留）     |
| 规则落点                                                           | 全部放 `src/packs/core/rules/**`（框架无关），`sources` 的相对层级与本地一致 |
| 结构声明里"角色/维度不存在"                                        | **直接报错**（fail-closed），不新增 notice code —— 避免动对外报告契约        |
| `notices` 类型                                                     | 上游是 `Diagnostic[]`；本移植不再往 notices 里塞结构声明消息                 |

## 步骤（每步一个提交 + `pnpm check` 绿）

1. ✅ **声明与类型扩展**：`engine/structure-spec.ts`（新，拆出结构声明词汇表，`types.ts` 触到 500 行上限）+ `engine/structure.ts`（解析 / 校验 / 加法合并 / overrides 覆盖）+ `config.ts` / `util.ts` 接线 + `tests/structure-declarations.test.mjs`
2. ✅ **组规则**：S35（原 S24 组必须有片段）· S25 保留名目录 · S26 组数量上限 · S27 目录子项上限 + `structure-util.ts` + 夹具
3. ✅ **图规则**：S28 组的外部引用下限（死切片）· S32 导入局部性 + 夹具
4. ✅ **命名**：S29 组名撞单元 · S30 重复词 · S31 单复数一致性 + `src/data/plural-forms.ts` + `pluralize` 采纳（登记三处：`portability.ts` 白名单 / `package.json` / 狗粮 `arch.config.mjs` 的 `deps({ allow })`）
5. ✅ **依赖图三件**：S08 依赖环 · S33 未解析导入 · S34 文件级入/出度 + 夹具
6. ✅ **适配面**：E2（`defineFacet` 开放注册）· T1（`router()` / `dataLayer()` / `styles()` + kit）· P12 同类方案不许混入 + `src/data/solution-alternatives.ts` + 两个 pack 的面声明
7. ✅ **FSD 预设对齐**：单文件片段（`model.ts`）· 入口认代码扩展名 · shared 每个片段都要公开面（含根入口豁免子目录）· 重名查组路径段 + 三个夹具（`fsd-parity` / `fsd-boundaries` / `fsd-import-locality`）
8. ✅ **文档增量**：CHANGELOG / README / PARADIGM / DESIGN / ALTERNATIVES / CONTEXT，按上游当前口径写（不再提基线；豁免用"规则级例外"），并跑 `--render-docs` 更新生成块

## 验收标准

- 每步：`pnpm check` EXIT=0（本机 Node 24.13.0）与 `nvm exec 22.18.0 … pnpm check` EXIT=0。
- 每条新规则都有「违规必报 × 合规不报」夹具（上游 `--self-test` + 夹具覆盖测试会卡）。
- 文档里不出现与上游相反的口径（基线 / 文件级 exempt / `--render-docs` 未实现等）。

## Comments

- 2026-09-24 起：`main` 已同步到 `d19363e`，上游基线在本机 `pnpm check` EXIT=0（30/30 夹具）。
- 2026-09-24 Step 1 完成并提交：`structure` 声明扩到 13 个字段；`types.ts` 500 行上限触发 → 拆出 `engine/structure-spec.ts`。
- 2026-09-24 Step 2 完成并提交：`packs/core/rules/structure-util.ts` + `structure-groups.ts`（S35/S25/S26/S27；
  S24→S35 重编号已落地），夹具 `structure-groups` / `structure-limits`（各 `exact: true`），
  `coreRules` 与 `library()` 启用名单已接。双 Node `pnpm check` EXIT=0（266 测试 / 32 夹具）。
- 2026-09-24 Step 3 完成并提交：S28（入度下限，`exceptLayers` / `singleFromLayers` 两条例外照社区口径）+
  S32（`structure-locality.ts`，默认关）。夹具 `group-in-degree` / `import-locality`（各 `exact: true`）。
  双 Node `pnpm check` EXIT=0（270 测试 / 34 夹具）。
- 2026-09-24 Step 4 完成并提交：命名三条 + `src/data/plural-forms.ts` + `pluralize`（三处登记：
  portability 白名单、package.json、狗粮 `deps({ allow })`；另按门禁要求同步了 tripwire 测试、
  AGENTS.md 生成块（`--render-docs` → `pnpm format`）与狗粮 M07 依赖预算 1→2）。
  夹具 `structure-name-collisions` / `structure-repetitive-naming` / `structure-plural-consistency`（各 exact: true）。
  双 Node `pnpm check` EXIT=0（276 测试 / 37 夹具）。
- 2026-09-24 Step 5 完成并提交：S08 / S33 / S34 落地，`structureGraphRules` 与 `library()` 接上。
  上线当天抓到三处真实问题：`structure-isolate` 夹具里少写一层 `..` 的 import（已修）、
  `violations` 夹具里**故意**的悬空再导出（写进注释并纳入期望）、`graph` 夹具里无意的 `shared/api` 依赖环
  （按"不为让规则变绿而改被测树"的原则保留，补注释与期望，成为 S08 第二个样例）。
  注意：上游 `examples/minimal` 的坏路径**已经不存在**（与 wip 判断不同）—— 扫过全仓与 40 个夹具，只有上述三处。
  双 Node `pnpm check` EXIT=0（280 测试 / 40 夹具）。
- 2026-09-24 Step 6 完成并提交：E2（面登记表 + `FACETS` 常量换成 `facetNames`/`facetSpec`/`facetOfCapabilityRoot`）、
  T1（三个方案面各带 kit + `router()`/`dataLayer()`/`styles()` 预设，各自贡献 P12）、P12 规则与数据表、
  `reactPack`/`tsPack` 的面声明（上游注释里"没有消费者已删"的三个面**连同消费它们的规则一起加回**）。
  `deps()` 域预设补 P12（否则"预设贡献规则集"守卫测试会红）。夹具 `solutions`（exact: true）。
  双 Node `pnpm check` EXIT=0（282 测试 / 41 夹具）。
- 2026-09-24 Step 7 完成并提交：在上游 v2.1 版 `fsd.ts`（环境特定公开面 / 官方典型段 / `@x` 明确未实现）之上增量加四件事：
  单文件片段角色、入口认代码扩展名、shared 每个片段的入口角色（ui/lib 走一级子目录 + 根入口豁免）、
  以及 12 个结构声明；同时把 S23③（`publicApiUnits` + 根入口豁免）落到 `packs/core/rules/structure-declared.ts`。
  三个 FSD 夹具移植完成（`fsd-parity` 的本地 S24 → **S35**），`fsd-preset` 期望不变。
  上游的 `fsd-conformance` 守卫测试保持绿（v2.1 断言没被覆盖）。双 Node `pnpm check` EXIT=0（282 测试 / 44 夹具）。
- 2026-09-24 **Step 6 的欠账（已识别）**：`routerLink` / `routeFile` / `queryKeyFrom` / `modulePattern` 四个适配器字段
  **没有消费者**（只有 types 与字段校验），违反本仓库"声明必须有消费者"的纪律。决定：先瘦身（只留 P12/P04/P01 真正读的
  `packages`），等有规则时"连同消费它的规则一起加回"。
- 2026-09-24 Step 8 完成并提交（**移植全部收尾**）：DESIGN §5.1 补 S08/S25–S35 行、§5.4 补 P12 行、
  已实现条数 56 → 69；§7.4 补 E2 面注册；§7.2 三条可替换面标成「T1 第一半已做」；
  §14 移除 E2 行、§16.4 改成「联网成熟度明确不做」。README 规则数与 Roadmap 同步。
  ALTERNATIVES 新增 §3.2.1「与 steiger 的规则对齐（现状）」+「三处有意更严」+ §5 标出 dc 三件已收回。
  CONTEXT 补「结构声明」词汇（组维度 / 组桶 / 公开面单元 / 保留名 / 词形表 / 方案面 / 同类方案）。
  CHANGELOG 写清这批移植（含 S24→S35 重编号与 pluralize 依赖）。双 Node `pnpm check` EXIT=0。
- 2026-09-24 **口径撤销**：用户要求"联网成熟度查询"这条**不再作为待办/不做项列出** ——
  README Roadmap 的那条待办、REQUIREMENTS 的 N-02、PARADIGM §12.5、DESIGN §16.4 都已删除
  （DESIGN §16.5 → §16.4）。上面那条移植记录保留为历史，现状是：`--verify-deps` 只做本地对账。
- 2026-09-25 **口径撤销**：S33「导入必须解析得到」被移除（用户判定为多余功能）——
  代码（规则实现 / `library()` 的 enable 项 / 专用夹具）、测试期望与 `violations` 夹具里的期望一并删掉；
  DESIGN §4.9 记入委派清单（→ eslint `import/no-unresolved`），REQUIREMENTS 的 R-04 状态改为「不做（委派）」，
  CHANGELOG 记了这条破坏性变更。**引擎事实 `graph.unresolved` 保留**（图与 `--explain` 要用）。
