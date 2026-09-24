# 把本会话的工作移植到上游（upstream port）

Status: in-progress

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
4. ⬜ **命名**：S29 组名撞单元 · S30 重复词 · S31 单复数一致性 + `src/data/plural-forms.ts` + `pluralize` 采纳（登记三处：`portability.ts` 白名单 / `package.json` / 狗粮 `arch.config.mjs` 的 `deps({ allow })`）
5. ⬜ **依赖图三件**：S08 依赖环 · S33 未解析导入 · S34 文件级入/出度 + 夹具（顺带修上游同样存在的两处坏路径：`examples/minimal` 的 `@/shared/lib/format`、`structure-isolate` 夹具里少写一层 `..` 的 import）
6. ⬜ **适配面**：E2（`defineFacet` 开放注册）· T1（`router()` / `dataLayer()` / `styles()` + kit）· P12 同类方案不许混入 + `src/data/solution-alternatives.ts` + `reactPack` 的面声明
7. ⬜ **FSD 预设对齐**：单文件片段（`model.ts`）· 入口认代码扩展名 · shared 每个片段都要公开面（含根入口豁免子目录）· 重名查组路径段（先读上游 v2.1 的 `fsd.ts`，在其上增量改）+ 三个夹具（`fsd-parity` / `fsd-boundaries` / `fsd-import-locality`）
8. ⬜ **文档增量**：CHANGELOG / README / PARADIGM / DESIGN / ALTERNATIVES / CONTEXT，按上游当前口径写（不再提基线；豁免用"规则级例外"），并跑 `--render-docs` 更新生成块

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
