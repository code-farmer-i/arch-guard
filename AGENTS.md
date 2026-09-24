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
              #   → 夹具回归 → 本体自包含(P1–P4) → 文档同步(--check-docs) → 示例宿主 → 狗粮(自己查自己)
```

**发布时**：把 CHANGELOG 的 `[Unreleased]` 切分成版本段落；契约变更（`apiVersion` / `NOTICE_CODES` /
`SKIP_CODES` / 退出码语义）必须在版本段落里标注「破坏性」与迁移方式 —— 版本记录是契约变更唯一的审计落点。

本仓库**不使用托管 CI**：门禁就是 `pnpm check`，谁提交谁在本地跑。所以别跳过它 —— 它同时承担 Node 22.18 与 24 的兼容性检查（`nvm exec 22.18.0 pnpm check`）。

两个不查文档就会踩的点：

- **`es/` 是构建产物**：源码内部 import 写 `./x.js`（TS 的 nodenext 只把 `.js` 映射回 `.ts`），所以 `node src/cli.ts` 跑不起来 —— 先 `pnpm build`，再 `node es/cli.js`。
- **狗粮**：改完引擎跑 `pnpm guard:self`（本体用 `library()` 范式检查自己）。

## 目录

| 位置                  | 是什么                                                                                                                               |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `src/engine/**`       | 引擎：扫描 / 事实模型 / 图 / 注册表 / 过滤器 / 报告 / scope / 依赖事实 / 自检                                                        |
| `src/packs/**`        | 框架包 = 源码形态的落地：`core/`（共享规则实现）· `typescript/`（`tsPack`）· `react/`（`reactPack`）；后两者今天共用 `core` 的规则集 |
| `src/presets/**`      | 预置与适配器：`canonical`（应用）/ `library`（库）/ `fsd` / `hygiene` / `ui-kits/*` / `i18n-kits/*`                                  |
| `src/data/**`         | 纯数据表：组件库指纹、轮子指纹、源码形态扩展名、通用产物目录（引擎零库名、零逻辑）                                                   |
| `__fixtures__/**`     | 被测项目夹具（故意含违规、坏语法、缺 `package.json` 等形态）                                                                         |
| `examples/minimal/**` | 干净的宿主示例（可搬运性验证）                                                                                                       |
| `arch.config.mjs`     | 门禁自己的配置（库范式 + 依赖选型 P + 度量 M07/M09）                                                                                 |

## 当前配置（由 `arch-guard --render-docs` 生成，**别手改**）

<!-- arch-guard:begin roles -->

| 角色          | 路径 glob                               | 层号 | 槽位    | 组  | 公开面 |
| ------------- | --------------------------------------- | ---- | ------- | --- | ------ |
| `test`        | `**/*.test.{ts,tsx,mts,cts,js,mjs,cjs}` | 99   | —       | —   | —      |
| `test`        | `**/*.spec.{ts,tsx,mts,cts,js,mjs,cjs}` | 99   | —       | —   | —      |
| `lib:entry`   | `src/index.ts`                          | 10   | `entry` | —   | —      |
| `lib:entry`   | `src/cli.ts`                            | 10   | `entry` | —   | —      |
| `lib:data`    | `src/data/**`                           | 1    | —       | —   | —      |
| `lib:engine`  | `src/engine/**`                         | 2    | —       | —   | —      |
| `lib:packs`   | `src/packs/**`                          | 4    | —       | —   | —      |
| `lib:presets` | `src/presets/**`                        | 4    | —       | —   | —      |

<!-- arch-guard:end roles -->

<!-- arch-guard:begin deps -->

**能力表**（`deps({ capabilities })`）：这个能力必须用哪个方案（驱动 P06 手搓指纹）

| 能力         | 首选方案    |
| ------------ | ----------- |
| `cli-args`   | `commander` |
| `word-forms` | `pluralize` |

**批准清单**（`deps({ allow })`，**非空才开启** P01「未登记即拒」）：

- `commander`
- `pluralize`

<!-- arch-guard:end deps -->

<!-- arch-guard:begin thresholds -->

| 阈值         | 值  | 被判的规则 |
| ------------ | --- | ---------- |
| 文件行数     | 500 | S16        |
| 页面行数     | 500 | S16        |
| 函数行数     | 150 | S16        |
| 单文件导出值 | 6   | S19        |
| 单文件组件数 | 3   | S19        |

<!-- arch-guard:end thresholds -->

## Agent skills

### Issue tracker

特性规格写在 `.scratch/<feature-slug>/spec.md`（模板 `docs/agents/spec-template.md`），实现票号在 `.scratch/<feature-slug>/issues/<NN>-<slug>.md`。约定见 `docs/agents/issue-tracker.md`。

### Triage labels

五个规范角色，字符串与角色名相同。见 `docs/agents/triage-labels.md`。

### Domain docs

单上下文：根 `CONTEXT.md` + `docs/adr/`。见 `docs/agents/domain.md`。
