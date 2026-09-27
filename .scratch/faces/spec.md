# 运行时面（runtime）与面值

Status: done

## 场景（对应 REQUIREMENTS.md 的 R-139 / R-140）

- **双运行时项目加一个域**时：域要交两个面 —— `modules/<域>/index.ts`（**宿主面**：服务 / 路由 / agent 工具）
  与 `modules/<域>/client.ts`（**浏览器面**：视图 / hook / 看板贡献）。
  **现在：不会报。** 层号是全序（S21 只能表达「向下依赖」），S22 只判「同维度、同层、不同组 → 禁」
  （把两个面当两个组，会让**该放行的**「宿主侧 import 宿主面」变成跨组被报 —— 方向正好反），
  S23 的 `entry` 是**无差别通行证**。实测 `dsh-workbench` 把 `modules/*` 与 `app/layouts` 放在**同一层**，
  「外壳 import 套件内部」在层号上完全合法 → 只能自己写构建图闸门 + 五条自定义规则。
- **装配层从公开面路径 import 域的内部实现**时（`import { createIssuesService } from '@/modules/issues'`
  —— 路径**合规**）：**现在：不会报。** S23 只保证「跨域必须走公开面」，**不管从公开面里拿了什么**。
  实测：`dsh-workbench` 重构前的外壳正是这样（他们自己的 `src/shared/api/host/unit-face.ts` 注释逐字记着
  `createIssuesService` / `issueRoutes` / `registerIssueTools` 那次踩坑）；重构后**面文件仍把内脏摊在外面**
  —— `issues/index.ts` 还导出 8 个内部名、`client.ts` 还导出 7 个，而**全项目零消费者**。
- **手搓这套判据的代价**（实测，同一轮重构内漂移两次）：`dsh-workbench` 自定义规则里的
  `resolveSpec` 把 `@/x` 只 `slice(2)` → 得 `modules/x`、后面却按 `src/modules/…` 匹配 →
  **规则在跑但永不报**；补上 `src/` 前缀后，裸面路径 `@/modules/issues` 解析出的深度是**空串**、
  却没算作面 → **把「从面进」误报成「走了内部」**（把正确写法判红）。引擎里本来就有 `resolveSpecifier`。

## 背景与问题

见 [`docs/adr/0008`](../../docs/adr/0008-runtime-faces-and-face-values.md)（决策与理由的唯一出处）。要点：

1. S23 今天有三档：① 组必须有入口 ② 组外不许绕过入口 ③ 无组单元也要有入口。缺的是
   **④ 谁该走哪扇门**（运行时兼容）与 **⑤ 门后能拿什么**（面值）。
2. `library()` 范式的域目录**没有 group / slot**（`lib:modules/issues` 只是一个目录角色），
   所以面**不能**做成角色字段 —— 声明必须在 `structure` 上。
3. 双运行时的"消费者在哪一侧"**不能按目录判**：workbench 第一版按目录划（`modules/<域>/model/` 算宿主侧），
   立刻把 `modules/sessions/model/session-node.ts` 这个**纯函数域模型**误判了 —— 它是域模型，浏览器当然可以用。

## 目标

- 让 `structure.runtimes: [{ name, entries[] }]` 与 `structure.faces: [{ pattern, runtime, value? }]`
  可声明，并由 **S23 ④⑤ 两档**消费（**不新开规则号**）。
- **消费者的运行时按可达性推导**：文件 A 属于运行时 r ⇔ A 从 r 的某个入口可达。
  于是**同构模块天然同时属于两个运行时**（可用任意面），而「只有浏览器能到」的文件不能进宿主面。
- **面值在提供侧判**：声明了 `faces[].value` 的面文件，其导出的**值**必须匹配该模式（类型豁免）。
  → 面外拿到内部实现在提供侧就不可能发生，消费侧不必逐 import 对账。
- 夹具照 workbench 的**真实形状**钉住两头（违规必报 × 合规不报）。

## 非目标

- **不判完备性**（「每个声明的面都必须有入口」）：实测的面是参差不齐的 —— `issues` 两面都有、
  `panels` 只有宿主面、`sessions` 只有业务公开面 —— 判完备性会直接误报。
- **不做任意兼容矩阵**（`host` 能不能进 `client` 面由项目声明）：v1 只做「运行时相等即兼容」。
- **不做逐文件 `runtime` 标注**：可达性推导已经给了更强的判据，标注只会让"忘标"变成静默放行。
- **不动事实模型**：`ImportFact.names` / `ExportFact` 已经够用（面值模式是**数据**，不是注释标注），
  所以 `FACTS_CACHE_SPEC` **不 bump**。
- **不做消费侧逐 import 对账**：提供侧成立时消费侧自动成立（这也是 S45 式对账在这里不必要的原因）。

## 验收标准

- 新夹具 `runtime-faces`（cap：照 workbench 形状 —— 双面域 / 单宿主面域 / 业务公开面域）：
  - **必报**：浏览器侧文件 import 宿主面；宿主侧文件 import 浏览器面；面文件导出不符 `value` 模式的值。
  - **不报**：宿主侧 import 宿主面；浏览器侧 import 浏览器面；同组内直引 `./model/*`；
    两个运行时都可达的同构模块用任意面；类型导入（`import type`）取面里的类型；孤儿文件。
  - `expect.json` 用 `exact: true`（多报也红）。
- 声明没写时两档都不跑（既有宿主零影响）—— 用一个「没声明 `faces`」的既有夹具回归覆盖。
- `pnpm check` EXIT=0（Node 24.13.0）；发版前按仓库规矩补跑 Node 22.18.0。
- 文档同步：`docs/DESIGN.md` §5.1 S23 行与 §6.2.1 声明段、`docs/adr/0008`、USAGE 的配置词汇。

## 边界与取舍

| 取舍                       | 决定                                                                                                                                                                                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `faces[].pattern` 怎么圈面 | **显式 glob**（`src/modules/*/index.ts`；捕获在这里没有消费者），不按「是不是套件」推 —— 所以 workbench 的 `sessions`（业务公开面、被浏览器消费）**不会**被圈进去；圈不进的域就别列                                                   |
| 可达性为空集（孤儿）怎么办 | **不判** —— S15 已经报孤儿，两条规则不许对同一件事各报一句                                                                                                                                                                            |
| 同组内引用要不要管         | 不管：S23 ② 本来就放行组内直引，面值这档也只对**面文件自身**的导出提要求                                                                                                                                                              |
| 活样板（`examples/`）      | **本版只落夹具 + 单测**：`examples/{minimal,full,full-fsd}` 全是单运行时，硬塞一个假运行时只会污染"0 finding 的活样板"。双运行时的真实形状已在 `dsh-workbench` 存在 —— 等它采纳这套声明，就有一份真样板可引（那是它的仓，本仓不代做） |
| 面文件里的类型             | 豁免（`typeOnly`）：类型是跨运行时的公共词汇，不是实现                                                                                                                                                                                |
| 一个 `runtime` 名字打错    | 与 `isolate` 同族 —— 由「声明了却 0 命中」的自述兜（R-86 / R-114），不新增机制                                                                                                                                                        |
| 被否掉的方案               | ① **角色字段**（library 范式无 slot，挂不上）② **目录划分**（workbench 实测误判纯函数）③ **逐文件标注**（漂移面大）④ **消费侧逐 import 对账**（提供侧已隐含，白加一趟）                                                               |

## Comments

- 2026-09-27：需求来自 `dsh-workbench`（双运行时 dsh 插件包）实做后的反馈；结论与实测证据见
  [`docs/adr/0008`](../../docs/adr/0008-runtime-faces-and-face-values.md)。
  字段定名 `runtime`（不叫 `face`：本仓已有 `facet` 与"公开面"两个词）；
  S23 ④⑤ 档；零事实模型改动。
- 2026-09-27 **落地**：`structure.runtimes` / `structure.faces`（`structure-spec.ts`）+ S23 ④⑤
  （`structure-declared.ts` 的 `runtimeFaceFindings`，可达性逐运行时算）。
  夹具 `runtime-faces` 照 workbench 形状（宿主面 / 浏览器面 / 只有宿主面的域 / 同构模块 / 孤儿 / 面值类型豁免），
  违规必报 × 合规不报双向钉住；`tests/runtime-faces.test.mjs` 4 例钉声明语义（自洽校验 / 空声明不判 /
  可达性推导 / 走错面要报）。`pnpm check` EXIT=0（Node 24.13.0）：夹具 95/95 ·
  自包含 P1–P4（120 文件）· 文档块同步（5 文件）· 三个示例照常 0 finding · 狗粮 39/107。
  **落地时才暴露的一处**：`faces[].pattern` 原本想支持 `{name}` 捕获，但 `globToRegExp` 把 `{…}`
  当**枚举**（捕获是 `scan.ts` 的另一套编译）—— 而面模式没有任何消费者需要那个捕获，于是**只收 glob**
  （`src/modules/*/index.ts`），ADR / DESIGN / USAGE 的口径一并改正。
