# arch-guard

把架构约束写成**可判定不变量**的编码门禁：本体是通用引擎 + 数据表，宿主项目只提供一张配置表。

规范 `PARADIGM.md`｜设计 `docs/DESIGN.md`｜词汇 `CONTEXT.md`｜决策 `docs/adr/`

## 改代码前

- 动**引擎 / 规则 / 预置 / 角色表 / 判定等级** → 先读 `PARADIGM.md`，并确认新规则仍落在 L1–L3（`createRule()` 会拒绝 L4/L5 的 error 级规则）。
- 动**宿主相关的东西** → 只能进宿主的 `arch.config.mjs`；本体里出现宿主字面量会被 `pnpm self-check-portability` 拦下。
- **加规则**：id 前缀必须与域一致（S/D/C/P/H），且必须在 `__fixtures__/` 有「违规必报 × 合规不报」的夹具 —— 没有夹具的规则等于没有规则。

## 提交前

```bash
pnpm --filter . exec arch-guard --stats        # 看每条规则的耗时与命中（规则该不该留）
pnpm --filter . exec arch-guard --verify-deps   # 适配表 vs 实际依赖对账
pnpm check    # ★ 一条命令跑完整门禁：build → typecheck → lint → format → test → coverage
              #   → 夹具回归 → 本体自包含(P1–P4) → 示例宿主 → 狗粮(自己查自己)
```

本仓库**不使用托管 CI**：门禁就是 `pnpm check`，谁提交谁在本地跑。所以别跳过它 —— 它同时承担 Node 22.18 与 24 的兼容性检查（`nvm exec 22.18.0 pnpm check`）。

两个不查文档就会踩的点：

- **`es/` 是构建产物**：源码内部 import 写 `./x.js`（TS 的 nodenext 只把 `.js` 映射回 `.ts`），所以 `node src/cli.ts` 跑不起来 —— 先 `pnpm build`，再 `node es/cli.js`。
- **狗粮**：改完引擎跑 `pnpm guard:self`（本体用 `library()` 范式检查自己）。

## 目录

| 位置                  | 是什么                                                                                                                                  |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `src/engine/**`       | 引擎：扫描 / 事实模型 / 图 / 注册表 / 棘轮 / 报告 / scope / 依赖事实 / 自检                                                             |
| `src/packs/react/**`  | 框架包：语言相关规则（`rules/{structure,structure-graph,structure-declared,design-*,copy,deps*,hygiene-context,metrics,placement}.ts`） |
| `src/presets/**`      | 预置与适配器：`canonical`（应用）/ `library`（库）/ `fsd` / `hygiene` / `ui-kits/*` / `i18n-kits/*`                                     |
| `src/data/**`         | 纯数据表：组件库指纹、轮子指纹（引擎零库名）                                                                                            |
| `__fixtures__/**`     | 被测项目夹具（故意含违规、坏语法、缺 `package.json` 等形态）                                                                            |
| `examples/minimal/**` | 干净的宿主示例（可搬运性验证）                                                                                                          |
| `arch.config.mjs`     | 门禁自己的配置（库范式 + 依赖选型 P + 度量 M07/M09 + 配置豁免）                                                                         |

## Agent skills

### Issue tracker

特性规格写在 `.scratch/<feature-slug>/spec.md`（模板 `docs/agents/spec-template.md`），实现票号在 `.scratch/<feature-slug>/issues/<NN>-<slug>.md`。约定见 `docs/agents/issue-tracker.md`。

### Triage labels

五个规范角色，字符串与角色名相同。见 `docs/agents/triage-labels.md`。

### Domain docs

单上下文：根 `CONTEXT.md` + `docs/adr/`。见 `docs/agents/domain.md`。
