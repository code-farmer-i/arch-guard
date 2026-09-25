# pnpm 工作区（多包）支持

Status: draft

## 场景（对应 REQUIREMENTS.md 的 R-50）

- **接 CI 时**：仓库里有 `packages/app` 与 `packages/ui` 两个包，每个都得 `cd` 进去跑一次门禁，
  CI 里用 shell 拼错误码 —— **漏跑一个包没人知道**，也没有"整体过没过"的一句话结论。**现在：不报**（`--workspace` 不存在）。
- **包边界形同虚设时**：`packages/app/src/x.ts` 里 `import { internal } from '@org/ui/src/internal/secret'`
  直接抓了内部文件；或者 `ui` 包反过来 import `app`。**现在：不报**（跨包路径被当成普通第三方 import 放行）。
- **在子包内按变更跑**：子包根 ≠ 仓库根，`--scope=changed` 的路径换算只能靠一条 notice 说明，
  没有逐包的汇总视角。**现在：一个包一次，人工汇总。**

## 背景与问题

现在 `runGuard` 把 `process.cwd()` 当作**唯一**的项目根：角色表、`include`、`layout`、`entries`、
`readProjectDeps` 全部相对它。于是 pnpm workspace 里的仓库只能：

- `cd packages/app && arch-guard` —— 一个包一次，没有汇总报告、没有统一退出码，CI 里要靠脚本拼；
- 或者硬把 `packages/*/src` 塞进一份角色表 —— 但角色表的不变量「每个文件恰好命中一个角色」是**单根**的，
  一旦跨包，`{domain}` 捕获、层号、`rootsOf()`（`${srcRoot}/modules`）与整组图规则都要变成「包 × 域」二维，代价是重写图规则。

需要：**让 pnpm 工作区可跑、可汇总、可判定**，而不破坏单包下的既有语义。

## 目标

- 识别工作区：从 `pnpm-workspace.yaml` 的 `packages:`（或 `package.json#workspaces`）读出包列表；都没有 → 不是工作区，行为与现在**完全一致**。
- 每个包**保留自己的一份 `arch.config.mjs`**（应用包 `canonical()`、库包 `library()`），范式与角色表不变。
- 新增 `arch-guard --workspace`：逐包运行 → 汇总报告 → **任一包有 error 则整体非零**。
- 汇总输出里每包一行结论；JSON 带 `packages[]` 与 `package` 字段；`--format=github` 的注解用**仓库根相对**路径。
- 未接入（没有 `arch.config.mjs`）的包**明列出来**，不静默当作通过。
- 明确报出「配置根 ≠ 仓库根」这个事实（现有 git 换算逻辑会打这条 notice，沿用）。

## 非目标

- **不为真实项目的现存目录提供"平铺预设"**：用这套范式就得先满足目录契约。`features/` `pages/` `components/`
  这类平铺布局不是"另一种合法形态"，而是**迁移前的状态** —— 迁到 `app/` `modules/` `shared/` 是接入的前置条件，
  与「范式不变量不配置」（PARADIGM §7.2）一致。工作区层不提供任何绕过它的口子。
- **不做「根一份配置管所有包」**：角色表保持单根，见「边界与取舍」。
- 不做包内多根（一个包一个源码根，现状即如此）。
- 不做跨包规则的实现（包级无环 / 内部包必须走公开面 / 包间禁止依赖）—— 那是第二阶段的独立 pack，算在下面「后续」。
- 不做并发跑包（先串行，报告好读；包数量级不大）。
- 不引入 YAML 依赖（本体只允许 `node:*` + `typescript` + `commander`）。

## 验收标准

- **不是工作区**：既没有 `pnpm-workspace.yaml` 也没有 `workspaces` 字段 → `--workspace` 明确报错「这不是工作区」；
  不带 `--workspace` 时行为与今天逐字节一致（现有 142 条测试不许动）。
- **工作区**：夹具里放两个包（一个 `canonical()` 应用包 + 一个 `library()` 库包），
  `arch-guard --workspace` 跑完两个包，报告里两个包各一行；注入一条违规到其中一包 → 退出码非零，另一包仍是「通过」。
- **配置根 ≠ 仓库根**：在子包内 `--scope=changed`，改子包文件能报出、改别的包的文件不报；notice 里出现「变更路径已换算到配置根」。
- **P 域按包算**：A 包的 `package.json` 依赖与 B 包不同时，`P01` 各按各的清单判（不会被根的清单串味）。
- **未接入可见**：有个包没放 `arch.config.mjs` → 报告里明列「未接入」，不算通过也不算失败。
- **工作区声明解析 fail-closed**：`pnpm-workspace.yaml` 里出现锚点 `&`/`*`、flow 风格 `[...]`、`---` 多文档、
  或没有 `packages:` → 明确报错并说明「本工具只支持 `packages:` 列表这个子集」，不猜。
- **缓存按包分开**：两个包各自命中各自的缓存（`cacheDirOf` 以包根为准：包内有 `node_modules` 就写进去，没有就写包根），
  不互相踢出。

## 边界与取舍

- **为什么不是「根一份配置」**：`include`/角色表/层号/图规则都是单根的。要跨包就得把「包」变成角色表的第一维
  （`packages/{pkg}/src/{domain}/views/**` + 每包一份 layers + `rootsOf` 二维化 + `readProjectDeps` 多清单化），
  等于重写 L3 图规则；而且「域内 import 规则塌缩成一句话」这条最大收益会消失（变成 `@/packages/<自己>/src/...`）。
  收益（一份报告）不值这个代价 —— 汇总层已经能给一份报告。
- **为什么每包一份配置是对的**：`readProjectDeps(config.root)` 天然读该包自己的 `package.json`（P01/P04/P05 白得正确）；
  `gitChangedFiles` 已经实现「配置根 ≠ 仓库根」的换算（白得正确）；工作区层只做发现 / 汇总 / 汇总口径。
- **路径口径**：单包模式报告用配置根相对（现状）；`--workspace` 汇总时统一换算成**仓库根相对**，
  否则 CI 注解与 `--paths` 对不上。包内 `arch.baseline.json` 仍按包根存（棘轮是包级事实）。
- **工作区声明只支持子集**：`packages:` 下的字符串列表（单/双引号、裸标量、`#` 注释）。不支持锚点、flow、多文档、嵌套 map ——
  遇到就报错。理由：不引 YAML 依赖的前提下，宁可支持得少而确定，也不要猜错包边界（猜错 = 有的包没被检查 = 假绿）。
- **缓存跨包撞键**：缓存键现在是 `rel`（相对配置根），两个包的 `src/app/main.tsx` 会撞同一条。
  因为 hash 里含内容，**不会给出错误结论**，但会互相踢出（每轮 miss）。当前按包跑 + `cacheDirOf(包根)` 已经天然分开了；
  将来若做「单进程共享一份缓存」，键必须带包前缀。
- **被否**：用 `pnpm m ls --json` 发现包 —— 要跑 pnpm、慢、且把「包管理器存在」变成硬依赖。
- **被否**：把工作区声明也变成一份 arch-guard 配置（两处真相，且改 pnpm 配置时容易忘）。

## 前置：每个包先满足范式（迁移，不是配置）

工作区支持的前提是**每个包里已经是一个合规的 `src/`**。现实项目通常是平铺形态，所以接入 = 先迁目录。
这张表就是迁移的机械部分（90% 是移动 + 改 import 前缀）：

| 迁移前（真实项目常见）                            | 迁到                                                                    | 说明                               |
| ------------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------- |
| `src/main.tsx`、`src/App.tsx`                     | `src/app/main.tsx`、`src/app/App.tsx`                                   | 装配层                             |
| `src/pages/**`、`src/features/<域>/**`            | `src/modules/<域>/views/`、`components/`、`hooks/`、`model/`、`lib/`    | 页面按**域**归位，不再有全局 pages |
| `src/components/{ui,common}`                      | `src/shared/components/{ui,common}`                                     | 哑基础件 / 业务中立组合件          |
| `src/components/<其他>`、`src/hooks/`、`src/lib/` | `src/shared/components/common/`、`src/shared/hooks/`、`src/shared/lib/` | 跨域共享                           |
| `src/theme.ts`、`src/i18n.ts`                     | `src/shared/theme/`、`src/shared/i18n/`                                 | 唯一出处                           |
| `src/ee/**`（企业版功能）                         | `src/modules/ee/**`（或按域拆开）                                       | 它是一个域，不是"特例目录"         |
| `src/vite-env.d.ts`                               | 原地（`src/*.d.ts` 已有角色）                                           | —                                  |

门禁在这个阶段**是迁移的向导**而不是障碍：S01/S03 会逐条指出文件"无处安放"，这正是要补的清单；
存量一次性进 `--update-baseline`，然后边迁边清（棘轮只减不增）。

## 后续（不在本规格内）

- **跨包规则 pack**：包依赖图（`workspace:*` 协议解析到本地包）→ 包级无环、`apps/*` 互不依赖、
  内部包必须走公开面（禁止 `@org/lib/src/internal/...`）、能力唯一出处。这些判据都落在 L1–L3，符合红线准入。

## Comments

- 2026-09-23 提出：现行「范围外」的立场（DESIGN §7.2 第 16 行）挡不住真实仓库；用户要求支持 pnpm 项目。
  结论：**工作区当汇总轴，不当角色表的一维**。
