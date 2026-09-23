# arch-guard 设计文档

> **本文写「应该是什么、为什么」，不写「现在到哪了」。**
> 进度、状态、Roadmap 属于 `README.md` 与 `CHANGELOG.md` —— 混进来就会 sediment：没人敢删、也没人读得完。

读者：维护本体的工程师。

| 你要找什么                           | 去哪                                                            |
| ------------------------------------ | --------------------------------------------------------------- |
| 规范（判据 / 目录契约 / 适配器协议） | [`PARADIGM.md`](../PARADIGM.md)                                 |
| 领域词汇                             | [`CONTEXT.md`](../CONTEXT.md)                                   |
| 为什么这么设计                       | [`docs/adr/`](./adr/)                                           |
| 现在实现到哪                         | [`README.md`](../README.md) + [`CHANGELOG.md`](../CHANGELOG.md) |
| 某个特性的规格                       | `.scratch/<feature-slug>/spec.md`                               |

文中 `tools/arch-guard/` 对应本仓库根；`arch.config.mjs` / `arch.baseline.json` 属于宿主项目。

**本文件只写「怎么实现」与「还没做什么」。** 遇到过时章节：原 §2/§3/§4 已迁到 `PARADIGM.md`（避免两处真相），§7.5 同理；原 §8/§9/§10/§11/§13/§15（交付物清单 / superhive 落地 / 分期 / 验收 / 待拍板 / 归属与抽取）已删除——它们要么属于状态（README + CHANGELOG + CI），要么已被"独立仓库 + P1–P3 自检"这个事实取代。

## 0. 摘要

把架构从「文档里的原则」变成**可判定的不变量**：一套编译期门禁，覆盖 **结构 / 设计系统 / 文案 / 依赖 / 反退化** 五个域，约束 agent 写代码的质量。

形态是三层分离：

| 层       | 内容                                                 | 可搬运性                                      |
| -------- | ---------------------------------------------------- | --------------------------------------------- |
| 通用范式 | 三条公理 + 10 个检测原语 + 4 张表 + 棘轮机制         | 写在 `tools/arch-guard/PARADIGM.md`，整篇可搬 |
| 通用引擎 | `tools/arch-guard/`，解析 / 建图 / 规则 / 报告       | **零项目字面量**，整目录可搬                  |
| 项目实例 | `arch.config.mjs`（填表）+ `ARCHITECTURE.md`（说明） | 每个仓库一份，约 60 行                        |

**红线只落在可判定等级 L1–L3**；L5 语义判断一律不写进红线，只列在「门禁管不到」清单里，保证零误报。

---

## 1. 定位与不在范围内

### 1.1 分工

| 工具                     | 管什么                                                                                         |
| ------------------------ | ---------------------------------------------------------------------------------------------- |
| oxlint / eslint          | 语法正确性、Hooks 规则、React 约定                                                             |
| tsc                      | 类型正确性                                                                                     |
| **arch-guard（本方案）** | **分层与边界、唯一出处、状态纪律、结构与命名、反退化、设计系统与魔法数字、文案契约、依赖选型** |
| 人 / review              | 域划分是否合理、抽象是否重复、命名是否恰当、该不该拆                                           |

`scripts/check-theme.mjs`（`lint:theme`）的能力**已全部并入 design / copy 域**（D01–D11 + D10b + C01–C03 + C06）。

**退役条件（两条都满足才删脚本）**：① `@arch-guard/core` 发布含 D/C 域的版本（≥ 0.2.0）；
② 宿主的 `pnpm lint` 链路里接上 `lint:arch`。在满足之前保留旧脚本 —— 先删等于把主题与文案覆盖
整个断掉（这两块刚由 D/C 域接管，还没进宿主的 lint 链路）。

迁移完成时的验收口径：**同一宿主上 D 域与旧守卫结论一致、C03 与旧守卫的 i18n 一致检查一致**。
superhive 上已按此口径验收：D 域 0 条、C03 0 条，与旧守卫「✔ 通过」等价。

### 1.2 非目标

- 不做 L5 语义判断（清单见 §5.6）。
- v1 不做自动修复（`--fix` 只留给未来确定性极高的少数规则）。
- 不引入任何**运行时**依赖；引擎只依赖目标仓库本来就有的 `typescript`。
- 不替代 CI/发布流程，只产出「过/不过 + 逐条修法」。

---

## 2. 门禁的可判定性模型

**规范在 [`PARADIGM.md`](../PARADIGM.md) §2（判定等级 L1–L5）。** 本文不再重复——重复的规范会变成两处真相。

## 3. 通用范式

**规范在 [`PARADIGM.md`](../PARADIGM.md) §1（三条公理）、§3（十个检测原语）、§5（五条设计律）、§4（四张表）。** 本文不再重复。

## 4. 目录契约（范式约定的项目结构）

**规范在 [`PARADIGM.md`](../PARADIGM.md) §6（三根拓扑 / 线性层序 / 槽位判定键 / 唯一落点 / 命名契约）。** 本文不再重复。

本仓库自己的角色表实现见 `src/presets/canonical.ts`（应用）与 `src/presets/library.ts`（库）。

## 4.9 委派清单（与 lint 生态不交叉）

判定标准：**纯语法/纯图属性、且不需要项目专有数据的约束，一律委派**；只有需要「角色表 / 适配器 /
能力表」这类项目数据的约束才由本工具实现。

| 已委派的约束                                    | 原规则      | 交给谁                                                                                                                        |
| ----------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `any` / 非空断言 / ts 注释逃生舱                | H01         | `@typescript-eslint/no-explicit-any` · `no-non-null-assertion` · `ban-ts-comment`                                             |
| console / debugger / alert                      | H03         | `no-console` · `no-debugger` · `no-alert`（oxlint 内置）                                                                      |
| 未完成标记（TODO 等）                           | H04         | `no-warning-comments`                                                                                                         |
| 空 catch / 空块                                 | H05         | `no-empty`                                                                                                                    |
| 假异步、`Math.random`、硬编码地址、假数据字面量 | H07–H09     | `no-restricted-syntax` / `no-restricted-properties` 选择器                                                                    |
| 文件行数 / 函数行数                             | S16         | `max-lines` · `max-lines-per-function`                                                                                        |
| 相对越级 `../`                                  | S10         | `no-restricted-imports`                                                                                                       |
| 依赖环                                          | S08         | `import/no-cycle` · dependency-cruiser `no-circular`                                                                          |
| 孤儿文件                                        | S15（部分） | dependency-cruiser `no-orphans`                                                                                               |
| 幽灵依赖 / 声明但未使用                         | P03 · P08   | `knip` · `depcheck`                                                                                                           |
| 颜色字面量只在色板                              | D01         | stylelint `color-no-hex` + `overrides`                                                                                        |
| `!important`                                    | D09         | stylelint `declaration-no-important`                                                                                          |
| 长度 / z-index / 时长白名单                     | D12–D14     | stylelint `declaration-property-value-allowed-list`                                                                           |
| JSX 裸文案                                      | C01         | `eslint-plugin-i18next` 的 `no-literal-string`（实测该插件**只有这一条规则**：不做键存在性与未使用键，所以 C02 / C06 留本体） |

**代价（必须知道）**：委派之后，**宿主没有对应工具就等于失去这层覆盖**。所以接入清单里要一起做：
装 eslint（含 typescript-eslint）、stylelint、knip，并在 `pnpm lint` 链路里跑起来。
本工具只保证「架构与契约」那一半。

## 5. 规则清单

规则 ID：`S` 结构 / `D` 设计系统 / `C` 文案 / `P` 依赖 / `H` 反退化。
等级 = 判定等级；级别 = error / warn。

> 本表是**完整设计**（含未实现项）。**已实现并带夹具的 49 条**（以 `arch-guard --stats` / `reactRules` 为准）：
> `S00–S07`、`S09`、`S11–S19`、`C02–C06`、`D03–D08`、`D10`、`D10b`、`D11`、`D16`、`D17`、`H06`、`P01`、`P02`、`P04–P07`、`M02–M09`。
> `S08`（无环）、`S10`（相对越级）、`P03`（幽灵依赖）、`P08`（死依赖）等已按 §4.9 **委派**给
> eslint / dependency-cruiser / knip，不在本体实现；`H01–H05`、`C01`、`D01/D02/D09/D12–D15/D18` 同理。

### 5.1 结构与边界（S）

| ID  | 红线                                                                                                                        | 判据        | 等级  | 级别  |
| --- | --------------------------------------------------------------------------------------------------------------------------- | ----------- | ----- | ----- |
| S01 | `src` 下只许 `app/` `modules/` `shared/` + `*.d.ts`；每层子项在角色表内                                                     | 目录白名单  | L1    | error |
| S02 | 目录深度 ≤3（相对 `src`）；域槽位内禁再嵌套                                                                                 | 路径        | L1    | error |
| S03 | 文件必须落在某个槽位（域根只许 `routes.tsx`）                                                                               | 路径        | L1    | error |
| S04 | 域内 import 只许 `./`、`@/modules/<自己>`、`@/shared`、第三方                                                               | import 前缀 | L3    | error |
| S05 | 域外只许 `import '@/modules/<域>/routes'`                                                                                   | 图          | L3    | error |
| S06 | `views/` 对域外私有                                                                                                         | 图          | L3    | error |
| S07 | `shared` 线性层序                                                                                                           | 图          | L3    | error |
| S08 | 全图无环                                                                                                                    | 图 DFS      | L3    | error |
| S09 | `app/layouts` 不得 import `modules/**`                                                                                      | 图          | L3    | error |
| S10 | 禁相对越级 `../`                                                                                                            | import 前缀 | L2    | error |
| S11 | 禁 barrel / `export *`                                                                                                      | AST         | L2    | error |
| S12 | 命名契约（目录/文件/导出名，§4.7）                                                                                          | 路径 + AST  | L1+L2 | error |
| S13 | 导出形态契约（§4.5）                                                                                                        | AST         | L2    | error |
| S14 | 有 `views/` 必须有 `routes.tsx`                                                                                             | 路径        | L1    | error |
| S15 | 无孤儿文件；域 `routes` 必被 `app/router` 聚合；每个 view 必被本域 `routes` 引用                                            | 可达性      | L3    | error |
| S16 | 体积：文件 ≤500（默认，可配）/ 单组件函数 ≤150                                                                              | AST 计数    | L2    | error |
| S19 | **宽度**：单文件导出值 ≤6 / 单文件组件数 ≤3（不含类型导出）。**仅应用范式** —— 库的入口就是公开面，导出几十个符号是对的形态 | AST 计数    | L2    | error |
| S17 | 同一导出名在两处定义（防复制粘贴实现）                                                                                      | AST         | L2    | warn  |
| S18 | `shared` 里的项只被一个域使用 → 应下沉域内                                                                                  | 图入度来源  | L3    | warn  |
| S20 | **框架包必须覆盖项目的源码形态**：出现当前 pack 量不了的源码（如 react pack 遇到 `.vue`）即报                               | 扩展名分派  | L1    | error |

### 5.2 设计系统与魔法数字（D）

| ID   | 红线                                                                                                                                 | 判据                 | 等级    | 级别            |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------- | ------- | --------------- |
| D01  | 颜色字面量只在 `tokens/palette.css`                                                                                                  | AST + CSS            | L2      | error           |
| D02  | palette 只放 `--sh-static-*`                                                                                                         | CSS                  | L2      | error           |
| D03  | 同一色值只写一次                                                                                                                     | CSS                  | L2      | error           |
| D04  | 令牌引用闭合（无悬空 `var()`）                                                                                                       | 令牌图               | L3      | error           |
| D05  | 无死令牌                                                                                                                             | 令牌图               | L3      | error           |
| D06  | 明暗两套令牌名一致                                                                                                                   | CSS                  | L2      | error           |
| D07  | 对比度基线（正文 4.5 / 弱文字 3.0 / 主按钮 4.2 / 链接 4.0 / 状态与 Tooltip 4.5）                                                     | `metric` 数值        | L2+数值 | error           |
| D08  | storage key 与 `index.html` 内联脚本一致                                                                                             | twinDeclaration      | L1+L2   | error           |
| D09  | 禁 `!important`                                                                                                                      | CSS/AST              | L2      | error           |
| D10  | **组件库选择器只许在 vendor 目录**：适配表声明的选择器前缀与变量前缀（如 antd 的 `.ant-*` / `--ant-*`）只许出现在 `styles/vendor/**` | 适配表 + 路径 + CSS  | L1      | error           |
| D10b | **vendor 目录反向封闭**：`styles/vendor/**` 里只许出现适配表声明的选择器 / 变量前缀，禁业务类名                                      | 适配表 + CSS         | L1      | error           |
| D11  | **无框架残留**：命中「已知组件库指纹」但不在本项目适配表内 → 报错；`.vue` / `@apply` / `dark:` 变体属通用禁用语法                    | 指纹表 + 适配表      | L2      | error           |
| D12  | **魔法数字·长度**：间距/尺寸/圆角/字号/边框必须走刻度令牌                                                                            | AST + CSS 属性上下文 | L2      | error           |
| D13  | **魔法数字·层级**：`z-index` 必须令牌                                                                                                | L2                   | error   |
| D14  | **魔法数字·时长**：动效时长必须令牌或常量                                                                                            | L2                   | error   |
| D15  | 内联样式纪律：禁颜色属性、禁裸数字与 `px/rem/em`                                                                                     | AST JSX              | L2      | error           |
| D16  | 自研样式只在 `*.module.css`                                                                                                          | 路径                 | L1      | error           |
| D17  | CSS Module 双向契约（`styles.X` 有定义 / 类被引用 / module.css 被同名组件 import）                                                   | CSS ↔ AST            | L2      | error           |
| D18  | 组件样式只消费语义令牌（禁直接引 `--sh-static-*`）                                                                                   | CSS                  | L2      | error           |
| D19  | 同一 `(属性, 数值)` 跨 ≥3 文件重复 → 提示提取令牌                                                                                    | AST + CSS            | L2      | warn（默认关）  |
| D20  | 请求策略与业务阈值数字必须有家（登记后生效）                                                                                         | AST 上下文           | L2      | error（默认关） |

**魔法数字语义域登记表**（D12–D14 / D20 的配置形态）：

| 语义域      | 触发形态                                                     | 唯一出处                             |
| ----------- | ------------------------------------------------------------ | ------------------------------------ |
| 间距 / 尺寸 | CSS 长度出现在 `padding/margin/gap/width/height/inset/top…`  | `--spacing` / `--size-*`             |
| 圆角        | `border-radius` 长度                                         | `--radius-*`                         |
| 字号 / 行高 | `font-size` / `line-height` 长度                             | `--text-*` / `--leading-*`           |
| 边框宽度    | `border: 1px` / `border-*-width`                             | `--border-width-*`（`1px` 例外可配） |
| 层级        | `z-index` / `zIndex`                                         | `--z-*`                              |
| 动效时长    | `transition/animation-duration`、JS `setTimeout/setInterval` | `--motion-*` / `shared/config`       |
| 内联尺寸    | JSX `style={{}}` 裸数字与 `'12px'`                           | 令牌或 CSS Module                    |
| 请求策略    | `staleTime/gcTime/retry/pageSize/timeout`                    | `shared/config` 命名常量             |
| 业务阈值    | 域内登记的比较值 / 上限                                      | `modules/<域>/model/`                |
| 协议码      | 与 `.status` / 错误码比较的数字                              | `shared/api` 语义常量                |

**自解释数字豁免**：`0`、`1`、百分比、无单位比例（`line-height`/`opacity`/`scale`/`aspect-ratio`）、属性级例外（`order`、`grid` 计数、未定义权重刻度时的 `font-weight`）、**`calc(var(--spacing) * N)` 这类带令牌的表达式**（逃生舱即令牌本身）。

**前缀与阈值均可配置**：本表出现的 `--sh-*`、`--spacing`、`--text-*`、`--radius-*` 都是 `designSystem({ tokenPrefix, scales })` 的取值；换项目只改配置，规则文本不硬编码前缀。

### 5.3 文案（C）

| ID  | 红线                                                                                                 | 判据                 | 等级  | 级别  |
| --- | ---------------------------------------------------------------------------------------------------- | -------------------- | ----- | ----- |
| C01 | **JSX 裸文本禁止**：文本节点只许表达式（`{t(...)}`）；当源语言含 CJK 时，非 locales 文件禁中文字面量 | AST JSXText + 字符串 | L2    | error |
| C02 | 每个 `t('k')` 的 key 必须中英都存在                                                                  | locales 索引         | L3    | error |
| C03 | 两份语言目录同构（文件集合一致 + 逐文件键一致）                                                      | 目录配对             | L1+L2 | error |
| C04 | 一文件一顶层命名空间，键前缀 = 文件名                                                                | AST + 路径           | L1+L2 | error |
| C05 | locales 文件必须被 `i18n/index` 聚合                                                                 | 图                   | L3    | error |
| C06 | 无死键（未被 `t()` 引用）                                                                            | 引用完整性           | L3    | warn  |

### 5.4 依赖（P）

| ID  | 红线                                                                                                          | 判据                    | 等级 | 级别  |
| --- | ------------------------------------------------------------------------------------------------------------- | ----------------------- | ---- | ----- |
| P01 | `dependencies` 必须在 `deps({ allow })` ∪ 适配表 `packages` 内（**显式开启**；能力表不隐式开启，见 ADR-0005） | `package.json`          | L1   | error |
| P02 | 明确禁用库（axios/ky/swr/redux/mobx/jotai/react-hook-form/tailwind/styled-components…）                       | `package.json`          | L1   | error |
| P04 | **适配表与实际依赖一致**：适配表声明的包必须在 `dependencies` 里；反向，装了适配表之外的组件库即报错          | 适配表 + `package.json` | L1   | error |
| P05 | **图标来源唯一**：图标 import 只许来自适配表登记的图标包                                                      | 适配表 + AST            | L2   | error |
| P03 | 幽灵依赖：import 了未声明的包                                                                                 | 图 + `package.json`     | L3   | error |

### 5.5 反退化（H）

| ID  | 红线                                                                                                                  | 判据         | 等级 | 级别  |
| --- | --------------------------------------------------------------------------------------------------------------------- | ------------ | ---- | ----- |
| H01 | 类型逃生舱：`any` / `as any` / 非空断言 / `@ts-expect-error` / `@ts-nocheck`                                          | AST          | L2   | error |
| H02 | suppression 注释：`eslint-disable` / `oxlint-disable` / `@ts-ignore`                                                  | 注释扫描     | L2   | error |
| H03 | 调试残留：`console.*` / `debugger` / `alert` / `confirm` / `prompt`                                                   | AST          | L2   | error |
| H04 | 未完成标记：`TODO` / `FIXME` / `XXX` / `HACK` / `WIP` / `not implemented` / `暂未实现` / `待实现`                     | 注释 + AST   | L2   | error |
| H05 | 吞异常：空 catch、`.catch(() => {})`                                                                                  | AST          | L2   | error |
| H06 | **脱离上下文的全局 API**：适配表登记的全局 API（`message.*` / `notification.*` / `Modal.confirm`…）必须走上下文内用法 | 适配表 + AST | L2   | error |
| H07 | 假异步与随机：`setTimeout` 模拟请求、`Math.random()`                                                                  | AST          | L2   | error |
| H08 | 硬编码地址：`http(s)://`、`localhost`、`127.0.0.1`（除 `shared/config/env.ts`）                                       | AST          | L2   | error |
| H09 | 静默假数据：`mock`/`fake`/`dummy`/`lorem` 字面量                                                                      | AST          | L2   | warn  |
| H10 | 手搓时间格式化（`toLocale*String` / `Intl.DateTimeFormat`）→ 用 dayjs                                                 | AST          | L2   | warn  |

### 5.6 severity 划分原则，以及门禁不做的事

`error` 只给 L1–L3 且「确定违规」；L4 视项目开启；**L5 一律不写**。门禁明确不管、靠 review 与设计把关的清单：

- 域划分是否合理、两个域该不该合并
- 组件来源优先级阶梯、覆盖阶梯是否被遵守（门禁只守它们的可判定后果：落点、令牌化、无残留、无重复实现）
- 组件该不该拆、抽象是否重复
- 命名是否恰当（正则只查形态，查不了质量）
- 翻译质量、对比度之外的视觉品味
- 类型与后端契约是否真的吻合
- 「这个常量该不该叫 `PAGE_SIZE`」「阈值 20 合不合理」

---

## 6. 引擎实现

### 6.1 机制分工

| 规则族                                          | 机制                                                       | 理由                                           |
| ----------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------- |
| 导入 / 依赖方向 / 公开面 / 环 / 可达            | TS AST + 自建 resolver → 文件图                            | 要区分 import 与字符串同文本                   |
| 导出形态                                        | TS AST（`ExportDeclaration`、modifiers、declaration kind） | 正则判不出 `export *`                          |
| 字面量唯一出处（颜色/数字/路由/storage/env）    | TS AST + CSS 扫描器，**带上下文**（属性名、参数键）        | `padding: 12px` vs 注释同理                    |
| 中文明文                                        | AST 字符串节点 + `JSXText`                                 | 注释天然不算（本仓库注释全中文）               |
| 类型逃生舱 / 调试残留 / 空 catch / 内联样式     | AST 节点种类                                               | 正则分不清 `Company`/`many`/`!x`/`!=`/`as any` |
| 体积                                            | AST 起止位置 + 导出计数                                    | 需精确行范围                                   |
| CSS 令牌 / 长度 / `!important` / `.ant-*` / hex | 自带 CSS 结构化扫描器                                      | 要区分属性名/值/注释                           |
| CSS Module 双向契约                             | CSS 类名集合 ↔ AST `styles.X`                              | 两侧都要结构化结果                             |
| 明暗令牌 / 引用闭合 / 死令牌                    | CSS 变量引用图（第二张图）                                 | 可达性算法                                     |
| 对比度                                          | 令牌解析 + 求值（沿用旧守卫实现）                          | 数值计算                                       |
| 目录白名单 / 深度 / 槽位 / 命名 / 配对          | 路径正则                                                   | 这里正则 100% 正确                             |
| TODO / suppression                              | 注释正则                                                   | AST 不保留注释节点                             |
| 依赖选型                                        | `JSON.parse` + 白名单                                      | —                                              |

### 6.1.1 解析后端：TypeScript Compiler API（parser-only）

**选型**：`ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, /* setParentNodes */ false, ts.ScriptKind.TSX)` —— **只 parse，不建 Program、不做类型检查**。

| 候选                                   | 新增依赖            | 速度 | 结论                                                |
| -------------------------------------- | ------------------- | ---- | --------------------------------------------------- |
| **TS Compiler API（选中）**            | 无（TS 仓库本就有） | 快   | 唯一同时满足「零新增依赖 + TS/TSX 全语法 + 可搬运」 |
| `@typescript-eslint/typescript-estree` | 有                  | 中   | 多出 scope 分析；我们刻意不依赖类型信息（L4 另开）  |
| `@babel/parser`                        | 有                  | 中   | 注释附着更好，但多一套语法插件矩阵                  |
| `oxc-parser`                           | 有（native）        | 极快 | 引入 native 依赖与多平台二进制，破坏「整目录复制」  |
| `swc` / `esbuild`                      | 有                  | 极快 | AST API 不公开 / 不为规则设计                       |
| `acorn` + 插件                         | 有（多个）          | 快   | TS/JSX 需自行组合，维护成本高                       |
| `tree-sitter`                          | 有（native）        | 极快 | 容错好，但引入查询语言生态                          |
| 纯正则                                 | 无                  | 极快 | 已在 §6.1 排除                                      |

**关键边界：规则不消费 TS AST。** `node.mjs` 把 AST 归一成**事实模型（facts）**，规则只读 facts：

```js
f = {
  path, rel, role,
  imports: [...], exports: [...],           // 依赖方向 / 公开面 / 导出形态
  strings: [...], jsxText: [...],           // 文案与字面量（带上下文）
  styleObjects: [...],                      // 内联样式：prop / value / kind / line
  calls: [...], catches: [...],             // 调试残留 / 吞异常
  functions: [{ name, lines, isComponent }],// 体积阈值
  tokens: [...],                            // 位置与范围
}
```

好处有两条：① **换 parser 只重写 pack 的 `parse` + 事实提取层，规则一行不改**；② pack 因此天然能承载别的元框架 —— Vue 用 `@vue/compiler-sfc`、Svelte 用 `svelte/compiler`，**都是目标仓库自带的编译器，所以「零新增依赖」跨 pack 依然成立**。

**一个实现坑（与 R2 相关）**：fail-closed 需要语法诊断，而 `createSourceFile` 的诊断挂在**非公开字段**（`parseDiagnostics`）。两条路：① 用 `ts.transpileModule({ reportDiagnostics: true })` 只取语法诊断（公开 API）；② 用内部字段 + TypeScript 版本区间断言。**无论哪条，都必须有 fixtures 覆盖「坏语法文件必须报错」**，否则 R2 落不了地。

**性能**：parser-only 约「100 文件 <300ms、1k 文件 ~1s」量级；配合 R7 的缓存与 `--changed` 可进开发环。撞性能墙时换 oxc 的代价 = 重写事实提取，不动规则。

### 6.2 目录与模块职责

```
tools/arch-guard/
  index.mjs        CLI：配置 → 扫描 → 解析 → 建图 → 规则 → 基线 → 报告
  scan.mjs         遍历、按扩展名选解析器、算角色（L1）
  resolve.mjs      别名与扩展名解析（别名从 tsconfig paths 读，不重复配置）
  node.mjs         AST 访问器：imports / exports / 字符串 / 调用 / JSX 属性 / 行号
  packs/react/     框架包：parse.mjs（ts.createSourceFile，只 parse 不启 Program）+ 角色表变体 + 语言相关规则 + fixtures
  parse/css.mjs    极简 CSS 结构化扫描器（框架无关）
  parse/json.mjs
  graph.mjs        import 图 + 令牌引用图 + 可达 / 环 / 入度来源
  adapters.mjs     defineAdapter：字段白名单 / 类型 / 正则 / 冲突校验 + 冻结（§7.4）
  registry.mjs     能力协商：requires 未满足的规则不注册，并记入 skipped
  detectors/{structure,design,copy,deps,hygiene}.mjs
  presets/{canonical,design-system,copy,deps,hygiene}.mjs
  presets/{ui-kits,data-layers,routers,styles,i18n}/<name>.mjs   各面适配器（纯数据）
  data/kit-fingerprints.mjs        已知组件库指纹（纯数据）
  baseline.mjs     棘轮
  report.mjs       按域/等级分组，带修法提示
  self-test.mjs    --self-test：跑 __fixtures__
  __fixtures__/    每条规则一对「违规必报 × 合规不报」样例
arch.config.mjs    项目实例（约 60 行）
```

规则是纯函数，只消费已解析好的上下文：

```js
export function noBarrel(ctx) {
  return ctx.tsFiles.flatMap((f) =>
    f.exports.filter((e) => e.isStar).map((e) => f.report('S11', e.node, '禁 barrel 再导出')),
  )
}
```

### 6.3 ctx 数据模型

```js
ctx = {
  root, config,
  files: [{ path, rel, role, kind: 'ts'|'css'|'json', text, ast?, css? }],
  graph: { edges, importersOf, reachable, cycles },
  tokens: { defined, referenced, themes: { dark, light } },
  cssModules: Map<modulePath, { classes, usedBy }>,
  locales: { namespaces, keys },
}
```

### 6.4 解析与图细节

- **别名**：从 `tsconfig` 的 `paths` 读（`ts.readConfigFile`），不在 `arch.config.mjs` 重复一遍。
- **动态 import**：`import()` 调用计入图（路由懒加载全靠它）。
- **CSS 图**：`@import`、`composes … from`、`url()` 计入，保证样式无孤儿。
- **外部包**：从 import 图抽出第三方包名，与 `package.json` 对账（P03）。

### 6.5 性能与开关

- 100 文件量级：扫描 + parse + 建图 <300ms；L1 规则先跑、失败先停。
- 默认只跑 L1–L3；`--type-aware` 走 tsc Program 跑 L4（CI 可选）。
- `--domain=<域>`、`--only=<ID>`、`--report`、`--update-baseline`、`--self-test`。

### 6.6 豁免通道

1. `arch.config.mjs` 里的结构性白名单（有理由、可评审）。
2. `arch.baseline.json`：`规则 + 文件 + 行文本哈希`，**只减不增**，过期条目 warning。
3. 无内联豁免。

### 6.7 自检（三条）

1. `--self-test`：每条规则的违规样例必须报、合规样例必须不报。
2. **角色表互斥完备**：`src` 下每个文件恰好命中一个角色。
3. **引擎零项目字面量**：`tools/arch-guard/**` 与 `presets/**` 不得出现项目路径 / 令牌前缀 / 具体组件库名（组件库名只许出现在 `presets/ui-kits/*` 与 `data/*`，见 §7.1）。

### 6.8 检测范围（scope）：全量与增量

> **实现状态**：facts 持久缓存已落地（`src/engine/facts-cache.ts`）。单文件键 = `rel + role + 内容 sha1`；
> 整份缓存的键 = `FACTS_CACHE_SPEC` + TypeScript 版本。缓存位置跟随 Vite 的策略：
> 有 `node_modules` 就写 `node_modules/.arch-guard-cache/facts.json.gz`，否则退回项目根 `.arch-guard-cache/`。
> 实测 3043 文件 / 21.5 万行：冷跑 5.88s → 热跑 1.22s。`--no-cache` 可关。

**（1）总原则：scope 过滤「报告」，不过滤「正确性」**

| 谓词类型       | 例子                                                               | 能否局部判定               |
| -------------- | ------------------------------------------------------------------ | -------------------------- |
| 单文件形态     | H01 `any`、S12 命名、D15 内联样式、S16 体积                        | ✅ 可                      |
| 单文件依赖出边 | S04 域内前缀、S10 `../`、S11 barrel                                | ✅ 可（只需本文件 import） |
| **全图谓词**   | S05 域隔离、S07 层序、S08 无环、S15 可达/孤儿、S18 shared 单域独占 | ❌ 必须全量图              |
| **全局唯一性** | D03 色值唯一、D05 死令牌、C03 双份同构、C06 死键、S17 重复导出名   | ❌ 必须全量                |
| **角色表完备** | S01–S03                                                            | ❌ 必须全量                |

**推论：`--changed` ≠「只解析变更文件」。** 正确分层是 **facts 按文件缓存，图与全局谓词每轮重建**：

```
解析（贵）  per-file facts
            缓存键 = 文件内容哈希 + 规则集版本 + 配置哈希 + ts 版本 + pack/适配器哈希
图 + 全局谓词（便宜）每次从 facts 重建 —— O(边数)，毫秒级
报告（scope）只输出范围内的 finding
```

这样"增量"不会引入 **stale-cache 假绿**（改了 A 影响 B 的判定、而 B 不在重算范围里）—— 这是增量门禁最经典的坑。

**（2）范围维度总表**

| 维度                              | 取值                                                 | 过滤什么 | 典型用法                                           |
| --------------------------------- | ---------------------------------------------------- | -------- | -------------------------------------------------- |
| `--scope`                         | `full`（默认）/ `changed` / `staged` / `since:<ref>` | 报告     | CI=full；pre-commit=`staged`；agent 迭代=`changed` |
| `--paths <glob>`                  | 路径                                                 | 报告     | 只跑某个域                                         |
| `--domain <S\|D\|C\|P\|H>`        | 域                                                   | 规则集   | 只看设计系统                                       |
| `--only <ID>`                     | 规则                                                 | 规则集   | 调一条规则                                         |
| `--min-level <L1\|L2\|L3>`        | 判定等级                                             | 规则集   | 快速档（只跑 L1）                                  |
| `--severity <error\|warn>`        | 严重度                                               | 报告     | 只看硬红线                                         |
| `--format <pretty\|json\|github>` | —                                                    | 输出     | agent 消费 / CI 注解                               |

**（3）安全语义（决定门禁可不可信）**

1. **不可归属的全局违规默认仍然失败**：`--changed` 下，全量谓词发现的违规若不落在变更文件上，**仍然报错**并标注「全局」；只有显式 `--local-only` 才降为「跳过并列出 N 条」。**禁止静默丢弃。**
2. **不许静默降级**：无 git → 明确降级 `full` 并打印；diff 为空 → 打印「无变更文件，仍执行全量谓词」。
3. **untracked 与 rename 必须正确处理**：untracked 纳入（agent 最常写新文件：`git ls-files --others --exclude-standard`）；rename 按改名处理而非「删+增」（否则 baseline 锚点与图都错）。
4. **pre-commit 跑 index 内容**：`--staged` 读 `git show :<path>` 的 blob 而非磁盘工作区文件 —— 否则会检查用户还没打算提交的改动，或漏掉已暂存的改动（hook 经典 bug）。
5. **baseline 过期检查只在 full 模式做**：增量运行不碰「未命中的基线条目」，否则每次 `--changed` 都刷一堆过期 warning。
6. **危险组合直接拒绝**：`--changed` / `--staged` + `--update-baseline`（会写出不完整基线，随后 full 爆红）。
7. **输出必须自述 scope**：`scope=staged(3 files) | 全量谓词在全项目快照上求值 | 全局违规 0 | 因能力停用 3 条`，防「以为全量在跑」。
8. **CI 必须 full**：`--changed` 是开发体验工具，不是门禁依据；CI 跑 `changed` = 假绿。写进文档与 CI 模板。

**（4）退出码**

| 场景                          | 退出码             |
| ----------------------------- | ------------------ |
| full，有 error                | 非零               |
| changed，变更文件有 error     | 非零               |
| changed，仅全局 error（默认） | 非零               |
| `--local-only` 且有全局 error | 零，但打印跳过条数 |
| `--report-only`               | 零，仅警告         |
| 引擎 / 解析异常               | **永远非零**（R2） |

**（5）配置形态**

```js
scope: { default: 'full', preCommit: 'staged', devLoop: 'changed', ci: 'full' }
```

`lint` 脚本用 `full`（与 CI 同一判决），`guard:dev` 用 `changed`，pre-commit hook 用 `staged`。

---

## 7. 配置与预设形态

```js
// arch.config.mjs —— 唯一导入面（抽成包时只改这一行）
import {
  canonical,
  designSystem,
  copy,
  deps,
  hygiene,
  uiKit,
  antdKit,
  reactPack,
} from './tools/arch-guard/index.mjs'

export default {
  packs: [reactPack], // 框架包（一个项目一个）：规则集由它给；CLI 不再硬编码规则数组
  presets: [
    canonical(), // 三根拓扑、角色表、命名、体积阈值
    designSystem({ tokenPrefix: '--sh', spacing: '--spacing', themes: ['dark', 'light'] }),
    copy({ locales: 'shared/i18n/locales', languages: ['zh-CN', 'en'] }),
    deps({ deny: ['axios', 'swr', 'redux', 'mobx', 'react-hook-form'] }),
    uiKit(antdKit()), // ← 换库 / 不用库只改这一行（见 §7.1）
    hygiene(),
  ],
  layout: { app: 'src/app', modules: 'src/modules', shared: 'src/shared' }, // 默认即范式
  overrides: {
    // 契约扫描域：默认由预设给（= 源码根）。域外文件不判契约、也不被逐文件规则扫，
    // 但仍进依赖图（角色 `(outside)`）—— 所以 tests/ 里的测试照旧把 src 接成可达。
    include: ['src/**'],
    thresholds: { fileLines: 500, viewLines: 500, functionLines: 150, exportsPerFile: 6 },
    semanticSlots: { requestPolicy: { keys: ['staleTime', 'retry', 'pageSize'] } },
  },
}
```

项目差异只写在 `overrides`；引擎与预设保持项目无关。

### 7.1 UI 组件库适配（可换、可不用）

**组件库是可选、可替换的配置轴，不是范式的一部分。** 引擎里不得出现任何具体库名。

**适配器契约** —— 每个字段驱动哪条规则：

| 字段               | 含义                                                       | 驱动的规则                               |
| ------------------ | ---------------------------------------------------------- | ---------------------------------------- |
| `id`               | 适配器标识                                                 | 报告与文档                               |
| `packages`         | 适配表声明的包（必须装在 `dependencies` 里；并入批准名单） | P04 一致性 · P01（allow 已开启时）       |
| `icons.from`       | 允许的图标来源包（唯一）                                   | P05                                      |
| `vendorSelectors`  | 该库的 DOM 选择器前缀（如 `\.ant-`）                       | D10 / D10b                               |
| `vendorVars`       | 该库的 CSS 变量前缀（如 `^--ant-`）                        | D10 / D10b                               |
| `detachedApis`     | 脱离上下文的全局 API 与替代写法                            | H06                                      |
| `styleProps`       | 内联样式入口 prop 名（React `style`；MUI `sx` / `css`）    | D15                                      |
| `themeIntegration` | 库主题映射的落点（CSS 目录 + JS 文件）                     | exclusiveOwner（S03 落点 + D10 边界）    |
| `policy`（可选）   | 组件来源阶梯、覆盖阶梯的文本                               | 只用于渲染 `ARCHITECTURE.md`，不参与红线 |

```js
// presets/ui-kits/antd.mjs —— 约 30 行，这就是"换框架"的全部成本
export default () => ({
  id: 'antd',
  packages: ['antd', '@ant-design/icons', '@ant-design/x'],
  icons: { from: ['@ant-design/icons'] },
  vendorSelectors: ['\\.ant-'],
  vendorVars: ['^--ant-'],
  detachedApis: [
    {
      from: ['antd'],
      members: ['message', 'notification'],
      call: true,
      suggest: 'App.useApp() 取 message/notification',
    },
    {
      from: ['antd'],
      members: ['Modal'],
      call: true,
      member: 'confirm',
      suggest: '<Modal /> 或 App.useApp() 的 modal',
    },
  ],
  styleProps: ['style'],
  themeIntegration: { css: 'shared/styles/vendor', js: ['shared/theme/antdTheme.ts'] },
  policy: {
    componentLadder: ['antd', '@ant-design/x', 'shared/components/ui', '一次性内联'],
    overrideLadder: [
      'theme.components',
      'vendor/antd-vars.css',
      '作用域变量',
      'CSS Module',
      'inline style',
    ],
  },
})
```

**三种用法**：

1. **用 antd**（superhive 现状）：`uiKit(antd())`。
2. **换任何库**：写一份约 30 行的适配器；`presets/ui-kits/` 里会附带 `none` 与 `antd`，并给出 `mui` 的骨架示例。
3. **不用组件库**：`uiKit(none())` —— `packages: []`、无 vendor 选择器、`styleProps: ['style']`。D10/D10b/P04/P05 自动失效，组件来源阶梯只剩「`shared/components/ui` 自研 + 复用」。**预设贡献规则：没声明的能力不产生规则**，不留空转红线。

**换库是可验收的**：`data/kit-fingerprints.mjs` 内置已知组件库指纹（antd `.ant-`/`--ant-`、Element `.el-`、Mantine `.mantine-`、Chakra `.chakra-`、Arco `.arco-`、Semi `.semi-`、Naive `.n-`、MUI `.Mui`/`@mui/*`、Vue `.vue`/`@apply`/`dark:` …）。换库后 D11 会扫出**旧库残留一条不剩** —— 这是可判定的迁移验收条件。

**元自检加强**：`tools/arch-guard/**` 与通用 `presets/**` 不得出现任何**具体框架/库名**（组件库、数据层、路由、样式方案、i18n 库），只许出现在 `presets/<面>/<name>.mjs` 与 `data/*`；违反即门禁自身报错。这条覆盖 §7.2 的全部适配器，是"可搬运"的总保证。

**元框架轴（本期范围）**：`metaFramework` 是独立一轴，取值表在 `src/data/framework-sources.ts`（纯数据，引擎里不出现框架名）。
v1 只有 React pack。**认不出、或还没有 pack 的框架一律 fail-closed 报错** —— 拿 Vue 跑只会得到「0 个文件 → ✔ 通过」的假绿，
所以宁可拒绝执行；已经混进 `.vue` 的项目由 **S20** 报出来（那些文件会被 `walk` 丢掉，不报就是静默失能）。
换 Vue / Svelte 需要换 parser 与整套规则集，属预留轴，不在本期。

### 7.2 其余可替换面（同类问题的一次性清查）

> **判据**：凡是「不改变架构、只改变写法」的选择，都是**可替换面**，必须有默认值 + 适配器；凡是「架构本身」的，写成不变量，不配置。

**（1）可替换面总表**

| #   | 可替换面            | 现在写死在哪                                                                | 换掉后崩什么                                                         | Tier              |
| --- | ------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------- | ----------------- |
| 1   | UI 组件库           | §7.1 适配表 ✅                                                              | —                                                                    | 已做              |
| 2   | **数据层**          | B3 Query 挂载点、C2 副作用禁取数、C3 mutation 必须失效缓存、S13 `use*Store` | 换 SWR / Jotai / Redux / Pinia / Vue Query → 规则识别不到触发点      | T1                |
| 3   | **路由模式与出口**  | 域公开面 = `routes.tsx`、paths 唯一出处、S15 routes 必被聚合                | Next / Remix / Nuxt 文件路由没有 `routes.tsx`                        | T1                |
| 4   | **样式方案**        | D16 自研样式只在 `*.module.css`、D17 双向契约                               | Tailwind 下 `@apply` 从「禁令」变「常态」；CSS-in-JS 没有 class 契约 | T1                |
| 5   | **i18n 形态**       | C 域全部按 `t('key')` + 两份 TS 嵌套对象                                    | `<FormattedMessage id>`、扁平 JSON、ICU 复数规则                     | T1                |
| 6   | 网络客户端          | B1 检测 `fetch / XHR / EventSource`                                         | 项目合法用 axios → B1 失去触发点                                     | T2                |
| 7   | 令牌来源            | D01–D07 全走 CSS 自定义属性                                                 | 令牌在 TS 对象（`theme.ts` / Style Dictionary）→ 扫描器读不到        | T2                |
| 8   | 主题机制            | `data-theme` 属性 + storage key                                             | class 切换、`prefers-color-scheme` 媒体查询                          | T2                |
| 9   | 装配与入口          | D08 校验 `index.html`；可达性入口 = `main.tsx`                              | Next / Nuxt 没有 HTML 模板                                           | T2                |
| 10  | 测试框架与布局      | `*.test.ts(x)` co-located 且豁免可达性                                      | Jest `__tests__/`、Playwright `e2e/` → 孤儿文件误报                  | T2                |
| 11  | 命名契约            | `*Page.tsx`、`use*`、`use*Store`                                            | 项目用 `*.view.tsx` / 自定义 hook 前缀                               | T2                |
| 12  | 导出风格            | views 必须 default export                                                   | 全 named export 的项目                                               | T2                |
| 13  | 硬编码文案判定      | 中文字符检测                                                                | 源语言是英文时失效 → 已改为 **C01「JSX 裸文本禁止」**（语言无关）    | T2 已缓解         |
| 14  | 依赖选型表          | P01 白名单（`deps({ allow })`）与文档里的选型表各写一份                     | 表改了、config 没改 → 漂移                                           | T1（见 §7.3）     |
| 15  | 时间库              | H10 建议 dayjs                                                              | date-fns / Temporal                                                  | T3                |
| 16  | 包管理器 / monorepo | 单包 + pnpm 锁文件                                                          | monorepo 需要多实例配置                                              | 范围外            |
| 17  | **契约扫描域**      | 全树遍历 + 宿主逐条 `ignore`                                                | 非源码 ts/css 全被报 S01；每个新工具配置都要补一条 ignore            | 已做（`include`） |

**（2）统一适配器契约**

所有适配器同形：`{ id, capabilities, rules }` —— **适配器贡献规则，引擎只负责调度**。未声明的能力对应的规则**不注册**（沿用「预设贡献规则」），所以「不用某个能力」不会留下一堆空转红线。

```
presets/ui-kits/{antd,none}.mjs            UI 组件库
presets/data-layers/{tanstack-query}.mjs   服务端状态 + 客户端状态
presets/routers/{react-router}.mjs         路由模式与出口
presets/styles/{css-modules}.mjs           样式方案
presets/i18n/{i18next}.mjs                 文案形态
```

T2 的适配器留同名目录与加载点，v1 只给默认值（默认值 = 现在的行为），不阻塞落地。

**（3）范式不变量（明确不配置）**

| 不变量                             | 为什么不能配                                                 |
| ---------------------------------- | ------------------------------------------------------------ |
| 三根角色划分（装配 / 业务 / 共享） | 路径可映射，**角色不可省**；省了就没有「一句话 import 规则」 |
| 唯一出处、依赖单向、无环、退路不留 | 三条公理本身                                                 |
| 目录白名单 / 深度 / 槽位封闭       | 结构不可被发明                                               |
| 域间零依赖、公开面唯一入口         | 模块化的定义                                                 |
| 红线只落 L1–L3、禁内联豁免         | 零误报与不可绕过性的保证                                     |

**（4）v1 明确不支持（不假装「配置即可」）**：元框架 Vue / Svelte；文件路由（Next / Remix / Nuxt）下的域结构规则；monorepo 多包；CSS-in-JS；TS 对象令牌；JS-only 项目。每项在文档里写「不支持」而不是「可配置」。

### 7.3 两处真相的收敛

P01 依赖白名单与 `AGENTS.md` 选型表不能各写一份；目录契约与 `ARCHITECTURE.md`、环境约定与 `THEME-ARCHITECTURE.md` 同理。规则：

- **`arch.config.mjs` 是唯一机读真相**（选型白名单、令牌前缀、层表、阈值）。
- 各文档中对应的块用**标记包起来**（`<!-- arch-guard:begin deps -->` … `<!-- arch-guard:end deps -->`），由 `--render-docs` 渲染。
- CI 加 `--check-docs`：渲染结果与文件不符即报错 —— 文档漂移变成可判定红线。

### 7.4 适配器通信协议

**结论：适配器是数据，不是插件。通信是单向契约 + 能力协商，引擎从不反向调用适配器。**

**（1）三条腿**

| 方向          | 机制                                                                          |
| ------------- | ----------------------------------------------------------------------------- |
| 适配器 → 引擎 | 工厂函数返回**纯数据对象**，经 `defineAdapter(面, spec)` 校验并冻结           |
| 适配器 → 规则 | 规则只读 `ctx.adapters.<面>`，不读 raw config                                 |
| 引擎 → 适配器 | **不存在**：无回调、无 hook、无生命周期；适配器不能执行项目代码、不碰文件系统 |

**（2）能力协商（「未声明即不注册」的实现）**

每条规则声明 `requires`（能力路径），registry 按适配器实际声明注册：

```js
// detectors/design.mjs
export const vendorSelectorConfined = {
  id: 'D10',
  requires: ['uiKit.vendorSelectors'],
  run: (ctx) => use(ctx.adapters.uiKit.vendorSelectors /* … */),
}
```

```js
// registry.mjs
const enabled = RULES.filter((r) => r.requires.every((cap) => hasCapability(ctx, cap)))
const skipped = RULES.filter((r) => !enabled.includes(r))
```

未满足能力的规则**跳过并在 `--report` 里明列**（「因能力未声明而停用：D10 / D10b / P05」）—— 避免「以为在跑、其实没跑」这种最危险的静默失能。

**（3）`defineAdapter` 的校验（专治静默失能）**

| 校验                                       | 挡住的失败模式                                                                         |
| ------------------------------------------ | -------------------------------------------------------------------------------------- |
| 字段白名单，未知字段即报错                 | 拼错 `vendorSelector`（少个 s）不会静默不生效                                          |
| 类型 + 正则可编译性                        | 非法正则不进入引擎                                                                     |
| 冲突检测：两个适配器声明同前缀             | antd 与 element 同时声明 `.ant-`                                                       |
| 一致性：声明的结构与项目事实对齐（运行时） | `routers.mode='code-based'` 但没有 `routes.tsx`；`packages` 不在 `package.json`（P04） |
| `specVersion` 兼容性                       | 搬到别的仓库后契约不兼容                                                               |

**（4）适配器自带样例（可证伪）**

模式类字段必须给命中/不命中样例，`--self-test` 直接跑：

```js
examples: { vendorSelectors: { hit: ['.ant-btn'], miss: ['.my-card'] } }
```

否则适配器写歪了正则没人知道 —— 与规则 fixtures 同等要求。

**（5）用户只填数据，要逻辑就贡献内置适配器**

配置里**不能写函数**。遇到数据表达不了的结构，在字段里声明形态（`styleProps: [{ name: 'sx', arg: 'object|function' }]`）；确实需要判定逻辑时，把适配器作为**内置适配器**贡献进引擎（随引擎分发、经评审、带 fixtures），而不是往项目配置里塞代码。三条理由：

1. **可判定性** —— 适配器若能执行任意逻辑，就无法证明规则仍只落 L1–L3；
2. **可自检 / 可序列化** —— 数据才能被 schema 校验、被报告展示、被 diff 评审、被整目录复制；
3. **安全** —— 配置不执行项目代码，不需要沙箱。

**（6）各面可组合、不互斥**：Tailwind + antd 混合很常见，`styles.kind='tailwind'` 与 `uiKit.vendorSelectors` 同时生效；registry 按能力并集注册。

### 7.5 可扩展性三层：配置 / 适配器 / 框架包

换 Vue 不是「再加一个适配器」—— 元框架（React ↔ Vue ↔ Svelte）比适配器高一层，因为**换元框架要换 parser 和规则集**。三层职责：

| 层              | 换什么           | 形态                                        | 举例                                                                    |
| --------------- | ---------------- | ------------------------------------------- | ----------------------------------------------------------------------- |
| **配置**        | 项目专有事实     | 数据表                                      | 路径、令牌前缀、阈值、白名单                                            |
| **适配器**      | 同一元框架内的库 | **纯数据表**（§7.4）                        | antd ↔ MUI、Zustand ↔ Jotai、CSS Modules ↔ Tailwind、i18next ↔ vue-i18n |
| **框架包 pack** | 元框架本身       | **代码**（随引擎分发、经评审、带 fixtures） | React pack（v1 唯一）、Vue pack、Svelte pack                            |

**pack 的职责**（决定「换元框架」的边界）：

- **parser**：React pack = `ts.createSourceFile`（TSX）；Vue pack = `vue/compiler-sfc`（template / script / style 三块）
- **角色表变体**：文件形态判据（`views/*.vue`、`<script setup>`、SFC 天然 default export）
- **规则集变体**：语言相关规则换实现（JSX 裸文本 → 模板插值；`use*` hooks → composables；SFC `<style scoped>` 是新规则）
- **fixtures**：pack 自带违规 / 合规样例

**跨 pack 复用、无需重写的部分**：三条公理、10 个原语、L1 全部规则、L3 图规则（import 图 / 域隔离 / 公开面 / 可达性 / 唯一出处）、CSS 与令牌 / i18n 资源 / `package.json` 类 L2 规则、棘轮与三条元自检。

**加一个 Vue pack 的量级**：SFC parser ~350 行 + 角色表变体 ~80 行 + React 专属规则替换（S13 / C01 / H06 等约 10 条）+ Vue 专属规则（模板插值、scoped 样式约 6 条）+ fixtures ~30 个文件 ≈ **半个引擎**。所以 Vue 不进 v1；但 **pack 边界必须在 v1 就划出来**（即使只有一个 React pack），否则将来加 Vue 是重写而不是加法。

---

## 12. 风险与取舍

| 风险                            | 应对                                                                                                     |
| ------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 误报毁掉门禁公信力              | 红线只落 L1–L3；每条规则有 fixtures；不确定的降 warn 或不写                                              |
| 迁移面大（三根拓扑 116 import） | 机械 codemod + type-check 全量验证；或退成「平铺但同样严格」（代价：域内 import 规则从一句话变回矩阵）   |
| CSS 扫描器覆盖面                | v1 声明支持范围（注释、@规则、块、变量、composes）；超范围（嵌套、`@layer`、CSS-in-JS）走 postcss 适配器 |
| 规则太严 → 大家刷 baseline      | baseline 行哈希 + 只减不增 + 过期条目 warning + diff 必审                                                |
| 门禁自身维护成本                | fixtures + 三条元自检，规则改动必须有回归                                                                |
| 门禁与文档漂移                  | 约定即配置：人读 `ARCHITECTURE.md`，机读 `arch.config.mjs`，同源生成                                     |

---

## 14. 已知缺口（未实现）

**只列还没做的。**（`--format=github` / `--stats` / `--verify-deps` / `definePack` / config·baseline 的 `specVersion` 均已落地，从本表移除）
已落地的能力见 [`CHANGELOG.md`](../CHANGELOG.md)，进度见 [`README.md`](../README.md) 的 Roadmap。

| ID   | 缺口                                                                                                                                                                                                                                                                                                                  | 影响                                                        |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| R1   | 应用范式的域只有 `routes.tsx` 一个公开面，跨域组合没有合法落点（缺 `index.ts` 契约）                                                                                                                                                                                                                                  | 跨域页面会挤进 `shared/components/common`，域边界从内部侵蚀 |
| R4   | 豁免只有 `exempt` 白名单与基线两条通道，缺「有理由 + 有期限」的结构化例外                                                                                                                                                                                                                                             | 正当的永久例外会被记成"存量债"，语义腐败                    |
| R6   | 有 `exempt`，但没有「生成代码必须带 `@generated` 标记」的可证伪要求                                                                                                                                                                                                                                                   | 豁免可以被随意扩大                                          |
| E2   | 适配器面清单（facet）仍硬编码在引擎里（已支持 i18n 面；新增面仍要动引擎）                                                                                                                                                                                                                                             | 加一个新面要动引擎                                          |
| D 域 | **11 条已落地**（D03–D08 / D10 / D10b / D11 / D16 / D17：色值唯一 / 令牌闭合 / 死令牌 / 明暗双份 / 对比度 / storage key / vendor 边界与反向封闭 / 无框架残留 / 样式落点 / CSS Module 双向契约）；**D01 · D02 · D09 · D12–D15 · D18 已委派后删除**（stylelint 的值白名单 + eslint 的 `no-restricted-syntax`，见 §4.9） | 委派出去的那半宿主要自己装并配好；没装等于失去覆盖          |
| C 域 | **5 条已落地**（C02–C06：键存在 / 多语言一致 / 一文件一命名空间 / 分片聚合 / 死键）；C01 裸文案委派给 `eslint-plugin-i18next`                                                                                                                                                                                         | 动态键（`t(\`ns.${x}\`)`）只按静态前缀放行，不做求值        |
| P07  | 弱指纹 + 命名指纹的「疑似自造轮子」判定未实现（见 `.scratch/wheel-detection/spec.md`）                                                                                                                                                                                                                                | 自研 `debounce` / `deepClone` 抓不到                        |
| —    | `--verify-deps`（联网查 npm 成熟度）未实现                                                                                                                                                                                                                                                                            | 新增依赖的成熟度只能靠人评审                                |

## 16. 选型纪律：优先成熟开源方案（反造轮子）

**问题**：「该不该用 dayjs / commander」是 L5 判断；直接判「是不是轮子」不可判定，会变成噪音。

**解法**：只钉可判定的后果，四类证据 + 两档强度。

### 16.1 依赖清单

| 数据         | 位置                                          | 说明                                                       |
| ------------ | --------------------------------------------- | ---------------------------------------------------------- |
| 能力表       | `arch.config.mjs` 的 `deps({ capabilities })` | 能力 → 首选方案；**没登记 = 没批准**（fail-closed）        |
| 手工轮子指纹 | `src/data/wheel-fingerprints.ts`              | 强指纹 / 弱指纹 / 库 API 名 / 推荐写法；纯数据，引擎零库名 |
| 组件库指纹   | `src/data/kit-fingerprints.ts`                | 同上，用于框架残留与换库验收                               |

### 16.2 规则

| ID  | 红线               | 判据                                                                               | 等级 | 级别  |
| --- | ------------------ | ---------------------------------------------------------------------------------- | ---- | ----- |
| P06 | 能力必须用登记方案 | 强指纹命中 ∧ 该能力首选库未声明或未被 import                                       | L2   | error |
| P07 | 疑似自造轮子       | 弱指纹命中 ∧ 自研模块导出名与库 API 名 ≥2 重叠                                     | L2   | warn  |
| P08 | 登记库必须真的被用 | 能力首选库已声明 ∧ 全项目零引用（死依赖）                                          | L3   | warn  |
| P09 | 平台内置优先       | `JSON.parse(JSON.stringify())` / `Math.random().toString(36)` / 手搓千分位等强指纹 | L2   | error |
| P10 | 新增依赖必须登记   | `dependencies` 不在能力表 / 白名单内                                               | L1   | error |

### 16.3 为什么这不误伤「写工具函数」

1. 只对**已知能力**生效：业务特有逻辑（领域 ID、专用计算）不在指纹表里，永远不管。
2. 两档证据：形态无歧义的才单证据报错；可能巧合的（弱指纹）必须叠加命名指纹，且只 warning。
3. `allowOwn: true` 的能力（query string、debounce、validation）只提示不报错。
4. 需要零运行时依赖的项目走 `exempt` 整体豁免，**理由写进配置**，豁免可见。

### 16.4 可选的成熟度校验

`--verify-deps`：查 npm 周下载量 / 最近发布时间 / 是否废弃 / license，阈值可配、结果缓存到 `.arch-guard-cache/`。默认关闭（网络不确定 + 慢），只在 CI 或依赖变更时跑。

### 16.5 落地顺序

已落地 P01/P02/P03/P06/P08；剩余部分见 `.scratch/wheel-detection/spec.md` 与 [`README.md`](../README.md) 的 Roadmap。

## Comments

- 2026-09-23 初稿：由多轮讨论收敛而成。核心取舍 —— **用「可判定性等级」约束规则集的表达力**，宁少勿滥，保证门禁零误报且能长期存活。
- 2026-09-23 补充 §7.1 UI 组件库适配：组件库降为可选、可替换的配置轴（适配表 + 指纹表），支持「用 antd / 换库 / 不用库」三种形态；引擎与预设禁止出现具体库名，由元自检强制。
- 2026-09-23 补充 §7.2 / §7.3：把同类问题一次性清查为 16 项可替换面（T1 五个建成适配器：数据层、路由、样式、i18n、UI 组件库），并划清「可替换面 vs 范式不变量」；同时消除选型表等两处真相（文档管理块 + `--check-docs`）。
- 2026-09-23 补充 §7.4 适配器通信协议：确定「适配器是数据不是插件」—— 单向数据契约 + 能力协商（`requires` 未满足则不注册并明列 skipped），`defineAdapter` 字段白名单校验防静默失能，适配器必须自带命中/不命中样例，用户配置禁写函数。
- 2026-09-23 补充 §7.5 可扩展性三层（配置 / 适配器 / 框架包）：明确 Vue / Svelte 属 **pack 层**（换 parser 与规则集，约半个引擎），不是适配器能解决的；v1 只交付 React pack，但 pack 边界现在就划出来，将来加 Vue 是加法而非重写。
- 2026-09-23 补充 §14 架构自审：18 项（P0 必修 R1–R5：跨域组合落点、解析失败 fail-closed、fixer 与棘轮冲突、第三豁免通道、锚点形态；健壮性 R6–R12；扩展性 E1–E6）。**R1 / R3 / R4 改动既有决定，待拍板后再改正文。**
- 2026-09-23 补充 §6.1.1 解析后端选型：确定 TS Compiler API parser-only（零新增依赖）；**规则只消费归一化事实模型（facts），不直接消费 TS AST** —— 换 parser 只重写 pack 的 parse/事实提取层，规则不动；Vue/Svelte pack 用各自框架自带的编译器，保持零新增依赖。同时记录 fail-closed 所需的语法诊断只能走 `transpileModule` 或非公开字段，必须由 fixtures 锁住行为。
- 2026-09-23 补充 §6.8 检测范围（scope）：确立 **scope 只过滤报告、不过滤正确性** —— facts 按文件缓存（增量），图与全局谓词每轮全量重建（防 stale-cache 假绿）；支持 `full/changed/staged/since` + 路径/域/规则/等级/严重度/格式筛选；不可归属的全局违规默认仍然失败，禁止静默降级与静默丢弃；pre-commit 跑 index blob；CI 必须 full。据此把 R7 从"缺口"改为"已设计"。
- 2026-09-23 补充 §15 门禁本体的归属与抽取：本体收进 `tools/arch-guard/` 单目录（含自带 `package.json`、唯一导入面 `index.mjs`、通用范式 `PARADIGM.md`），项目只留 `arch.config.mjs` / `arch.baseline.json` / `ARCHITECTURE.md`；确立本体自包含三条可机检不变式 P1–P3（只依赖 `node:*`+`typescript`+本体相对路径、无项目字面量、项目事实只经 `--config`）；抽取时只改 config 一行 import，不引入 workspace。`scripts/arch-baseline.json` → `arch.baseline.json`，范式文档 → `tools/arch-guard/PARADIGM.md`。
