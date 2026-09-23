# 架构门禁 arch-guard 完整方案

> **本文是设计文档（从 superhive 仓库迁出）。** 在本仓库里，「本体」= 仓库根本身；
> 文中 `tools/arch-guard/` 对应本仓库根，`arch.config.mjs` / `arch.baseline.json` 属于宿主项目。
> 面向使用者的规约见 [PARADIGM.md](../PARADIGM.md)，快速上手见 [README.md](../README.md)。

Status: draft（待拍板）
作用域：通用范式 + 通用引擎；superhive 是其第一个实例

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

`scripts/check-theme.mjs`（`lint:theme`）的能力**并入 design 域**，旧脚本退役（见 §9.2）。

### 1.2 非目标

- 不做 L5 语义判断（清单见 §5.6）。
- v1 不做自动修复（`--fix` 只留给未来确定性极高的少数规则）。
- 不引入任何**运行时**依赖；引擎只依赖目标仓库本来就有的 `typescript`。
- 不替代 CI/发布流程，只产出「过/不过 + 逐条修法」。

---

## 2. 门禁的可判定性模型

| 等级              | 依赖的信息  | 能判定的事                                            | 可信度     | 成本        |
| ----------------- | ----------- | ----------------------------------------------------- | ---------- | ----------- |
| **L1 路径**       | 路径字符串  | 目录白名单、深度、槽位、命名、文件配对                | 100%       | 极低        |
| **L2 单文件 AST** | 一个文件    | import 前缀、导出形态、字面量与上下文、语法红线、体积 | ~100%      | 低          |
| **L3 文件图**     | import 图   | 依赖方向、域隔离、公开面、可达性、唯一出处、死物      | ~100%      | 中          |
| **L4 类型**       | tsc Program | 类型级契约                                            | 高         | 高（3–10s） |
| **L5 语义**       | 人的理解    | 「是否业务中立」「命名好不好」「该不该拆」            | **判不了** | —           |

**铁律：error 级红线只准落在 L1–L3。** L4 单独用 `--type-aware` 开关，不进默认路径。L5 不写。

---

## 3. 通用范式

### 3.1 三条公理

1. **真相唯一**：一个概念只有一个出处，其余地方只能引用，不能复写。
2. **依赖单向**：层只向下依赖；跨模块只走公开面；不许有环。
3. **退路不留**：类型逃生舱、调试残留、未完成标记、假数据、吞异常一律无豁免。

### 3.2 十个检测原语

| #   | 原语                 | 回答的问题                              |
| --- | -------------------- | --------------------------------------- |
| 1   | `forbidDependency`   | 谁不许依赖谁（层 / 模块 / 第三方包）    |
| 2   | `requireEntryPoint`  | 这个模块的公开面是什么                  |
| 3   | `exclusiveOwner`     | 这个能力 / 形态只许在哪出现             |
| 4   | `mustReference`      | 别处必须引用常量 / 令牌，不许复写字面量 |
| 5   | `twinDeclaration`    | 必须同步的多份声明是否一致              |
| 6   | `referenceIntegrity` | 定义↔引用闭合：无悬空、无死物           |
| 7   | `onlyComponentIn`    | 某能力只许挂在指定位置                  |
| 8   | `forbidSyntax`       | 语法 / 形态红线                         |
| 9   | `limit`              | 体积与接口宽度                          |
| 10  | `metric`             | 数值断言（内置求值器：WCAG 对比度等）   |

外加两个图能力：`reachability`（无孤儿）、`cycles`（无环）。

> 颜色 / 路由 / 持久化 key / 环境变量 / **魔法数字** / 文案 key —— 全部是 `mustReference` 的实例，共用一张「语义槽表」，不各写一套规则。

### 3.3 四张表（写进 `arch.config.mjs`）

1. **角色表**：角色 → 路径 glob → 允许的导出形态 → 依赖档位
2. **公开面表**：模块 → 唯一入口文件
3. **语义槽表**：概念 → 唯一出处文件 → 触发形态
4. **阈值与白名单表**：体积、允许依赖、结构性豁免
5. **适配表**（UI 组件库适配器）：包名、选择器前缀、全局 API、样式入口、主题集成落点 —— 见 §7.1。**组件库是可选、可替换的维度：不用库（`ui-kits/none`）或换库，都只换这张表，引擎零框架知识。**

### 3.4 棘轮机制

存量违规写进 `arch.baseline.json`，条目 = `规则 + 文件 + 该行文本哈希`：

- 被豁免的**那行代码一改，豁免立即失效**，必须按新高线写。
- 官方通道只有两个：**config 结构性白名单**（有理由、可评审）与 **baseline**（存量、只减不增）。
- **禁止内联豁免注释**（既然把 `eslint-disable` 当红线拦，就不开 agent 能随手写的后门）。
- 未命中的过期 baseline 条目 → warning，催清偿。

### 3.5 五条门禁友好设计律

| 律                    | 内容                                                              |
| --------------------- | ----------------------------------------------------------------- |
| D1 路径即角色         | 角色由路径唯一确定，不必读内容                                    |
| D2 槽位按依赖档位定义 | 槽位的定义是「能依赖什么 / 能导出什么」，不是「放什么语义的东西」 |
| D3 封闭枚举           | 合法路径形态穷举，未登记即红（白名单 > 黑名单）                   |
| D4 契约同构配对       | 必须同步的 N 份声明放同一目录、命名同构                           |
| D5 图必须可读         | 禁 barrel/`export *`、禁 `../`、别名统一                          |

### 3.6 形式化判据

> 存在一张角色表，使 `src` 下**每个文件恰好命中一个角色**，且判据只用「路径 + 导出形态 + 依赖档位」。

- 命中 0 个 → 结构不完备；命中 ≥2 个 → 有歧义，门禁无法裁决。
- 该判据本身是**门禁的元自检**：拿当前 `src` 跑一遍角色表，不互斥/不完备 → 报错。

---

## 4. 目录契约（范式约定的项目结构）

### 4.1 三根拓扑

```
src/
├── app/        装配：唯一「全知」层
├── modules/    业务域：互不相识，各自自治
└── shared/     跨域共享：严格线性层序，不得含域语义
```

**为什么是三根而不是平铺**：域内 import 规则可以塌缩成一句话 —— `./`、`@/modules/<自己>/…`、`@/shared/…`、第三方包。平铺版要维护一张 10 个前缀的矩阵，agent 记不住、门禁也要枚举。

### 4.2 完整目录

```
src/
├── app/
│   ├── main.tsx                       挂载（index.html 唯一入口）
│   ├── App.tsx                        Provider 装配（Query / Theme / i18n / Router）
│   ├── router/
│   │   ├── index.tsx                  只聚合：根路由 + 布局守卫包裹 + 各域 routes
│   │   ├── guards.tsx                 登录 / 角色门禁
│   │   └── fallback.tsx               路由级降级
│   └── layouts/
│       ├── AppShell.tsx  AuthLayout.tsx
│       └── components/                外壳私有部件
├── modules/
│   └── <域>/
│       ├── routes.tsx                 **公开面：唯一可被域外 import 的文件**
│       ├── views/                     页面 <名词>Page.tsx（default export）
│       ├── components/                域内私有 UI
│       ├── hooks/                     域内编排
│       ├── model/                     域内类型 / 常量 / 状态
│       ├── lib/                       域内纯函数
│       └── assets/                    域私有图片 / 字体
├── shared/
│   ├── styles/                        ★ 视觉唯一出处
│   │   ├── index.css                  装配入口（按序 @import）
│   │   ├── tokens/{palette,foundation,scales,theme}.css
│   │   ├── vendor/{antd-vars,antd-overrides}.css
│   │   └── base.css
│   ├── lib/                           纯函数（无副作用、无项目语义）
│   ├── config/                        ★ 项目常量
│   │   ├── env.ts                     环境变量 / 后端地址
│   │   ├── paths.ts                   路由路径
│   │   ├── storage.ts                 持久化 key 与读写
│   │   └── nav.tsx                    导航（跨域排序是应用级决策）
│   ├── i18n/
│   │   ├── index.ts                   聚合 + 初始化
│   │   └── locales/<lang>/<命名空间>.ts
│   ├── api/
│   │   ├── http.ts                    ★ 网络原语唯一出口
│   │   ├── queryKeys.ts               ★ query key 唯一出处
│   │   ├── queryClient.ts             缓存装配（唯一允许读 stores 的例外）
│   │   ├── types.ts                   后端契约类型
│   │   └── <资源>.ts                  端点函数
│   ├── stores/                        客户端状态快照
│   ├── theme/                         主题装配与令牌解析
│   ├── hooks/                         ★ 唯一 Query 挂载点
│   ├── components/
│   │   ├── ui/                        哑基础件：禁 hooks / stores / api
│   │   └── common/                    业务中立组合件：可用 hooks/stores，禁 api 值
│   └── assets/                        共享图片 / 字体
└── *.d.ts                             全局类型声明
public/                                原样发布的静态文件
```

### 4.3 `shared` 线性层序

只许向**层号 ≤ 自己**的层 import；同级允许；全图禁环。

| 层号 | 目录              | 职责                                        |
| ---- | ----------------- | ------------------------------------------- |
| 0    | `styles` `assets` | 无代码依赖                                  |
| 1    | `lib`             | 纯函数，无副作用、无项目语义                |
| 2    | `config`          | 项目常量：环境 / 路径 / 持久化 / 导航       |
| 3    | `i18n`            | 文案资源与初始化                            |
| 4    | `api`             | 契约与传输（禁 React / antd / stores / UI） |
| 5    | `stores`          | 客户端状态快照（api 仅 `import type`）      |
| 6    | `theme`           | 主题装配与令牌解析                          |
| 7    | `hooks`           | 跨域编排                                    |
| 8    | `components`      | 通用 UI                                     |

### 4.4 域模块契约

- 域内固定 **7 个槽位**，禁止再嵌套、禁止在域根散落文件（只许 `routes.tsx`）。
- **公开面只有 `routes.tsx`**：页面由本域 `routes.tsx` 懒加载，`views/` 对域外完全私有。
- **域间零依赖**：域外只能 `import '@/modules/<域>/routes'`。
- 加一个域的完整成本：建 `modules/<域>/`（routes + views）+ 两份 locale 文件 + `shared/config/paths.ts` 加常量 + `app/router/index.tsx` 加一行聚合。**四处全是加法，不改任何已有域**；删域反向。
- 域内线性槽序：`lib < model < hooks < components < views`，`routes.tsx` 在最上层。

### 4.5 槽位判定键表（= 角色表的判据）

| 槽位                                 | 允许导出形态（L2）                       | 依赖档位（L3）                                 | 等级  |
| ------------------------------------ | ---------------------------------------- | ---------------------------------------------- | ----- |
| `app/main.tsx` `App.tsx`             | 挂载副作用 / 组件                        | 一切                                           | L1+L3 |
| `app/router/**`                      | `router` / 组件                          | 只许 layouts、guards、各域 `routes`            | L1+L3 |
| `app/layouts/**`                     | 组件                                     | **禁 `modules/**`**                            | L2+L3 |
| `modules/<域>/routes.tsx`            | 导出 `*Routes: RouteObject[]`            | 同域 + `shared/**`                             | L2+L3 |
| `modules/<域>/views/*.tsx`           | **default export 组件**，名 `*Page`      | 同域 + `shared/**`                             | L2+L3 |
| `modules/<域>/components/**`         | 组件（PascalCase）                       | 同域 + `shared/**`                             | L2+L3 |
| `modules/<域>/hooks/**`              | 只导出 `use*` 函数                       | 同域 + `shared/**`                             | L2+L3 |
| `modules/<域>/model/**`              | 只导出 `type`/`interface`/字面量 `const` | 同域 + `shared/**`                             | L2    |
| `modules/<域>/lib/**`                | 只导出函数，禁 JSX                       | 同域 + `shared/**`                             | L2    |
| `modules/<域>/assets/**`             | 非代码（扩展名白名单）                   | 无                                             | L1    |
| `shared/styles/**`                   | 非代码                                   | 无                                             | L1    |
| `shared/lib/**`                      | 只导出函数                               | 零项目内部依赖                                 | L2+L3 |
| `shared/config/**`                   | 常量 / 纯函数                            | 只许 `shared/lib`                              | L2+L3 |
| `shared/i18n/index.ts`               | i18n 实例 + 资源聚合                     | `lib`、`config`、locales                       | L3    |
| `shared/i18n/locales/<lang>/<ns>.ts` | **default export 对象，顶层键 = 文件名** | 无                                             | L1+L2 |
| `shared/api/**`                      | 端点函数 / 类型 / keys                   | `config`、`lib`；禁 React / antd / stores / UI | L2+L3 |
| `shared/stores/**`                   | 导出 `use*Store`                         | `config`、`lib`；api 仅 type                   | L2+L3 |
| `shared/theme/**`                    | 组件 / 函数                              | `stores`、`config`、`lib`、`styles`            | L3    |
| `shared/hooks/**`                    | 只导出 `use*` 函数                       | `api`、`stores`、`config`、`lib`               | L2+L3 |
| `shared/components/ui/**`            | 组件                                     | **禁 `hooks`/`stores`/`api`**                  | L2+L3 |
| `shared/components/common/**`        | 组件                                     | 允许 `hooks`/`stores`；禁 `api` 值             | L2+L3 |
| `**/*.test.ts(x)`                    | 测试                                     | 豁免图规则                                     | L1    |
| `src/*.d.ts`                         | 全局声明                                 | 无                                             | L1    |

### 4.6 唯一落点表与反例表

| 要写的东西                       | 唯一落点                                                                           |
| -------------------------------- | ---------------------------------------------------------------------------------- |
| 页面                             | `modules/<域>/views/<名词>Page.tsx`                                                |
| 域内组件 / 哑基础件 / 中立组合件 | `modules/<域>/components/` / `shared/components/ui/` / `shared/components/common/` |
| 跨域编排 / 域内编排              | `shared/hooks/use<资源>.ts` / `modules/<域>/hooks/`                                |
| 端点封装 / 契约类型 / query key  | `shared/api/<资源>.ts` / `types.ts` / `queryKeys.ts`                               |
| 域内类型常量 / 域内纯函数        | `modules/<域>/model/` / `modules/<域>/lib/`                                        |
| 路由路径 / 路由分片              | `shared/config/paths.ts` / `modules/<域>/routes.tsx`                               |
| 持久化 key / 环境变量            | `shared/config/storage.ts` / `shared/config/env.ts`                                |
| 文案                             | `shared/i18n/locales/<lang>/<命名空间>.ts`                                         |
| 颜色 / 语义令牌 / 第三方映射     | `shared/styles/tokens/palette.css` / `theme.css` / `vendor/*`                      |
| 组件私有样式                     | 同目录同名 `.module.css`                                                           |
| 客户端 UI 状态                   | `shared/stores/<名词>.ts` → `use<名词>Store`                                       |
| 测试                             | 同目录同名 `*.test.ts(x)`                                                          |

| 错误落点                                   | 正确的家                                          | 为什么                       |
| ------------------------------------------ | ------------------------------------------------- | ---------------------------- |
| `src/utils/` `src/helpers/`                | `shared/lib`                                      | 顶层只有三根                 |
| `src/services/`                            | `shared/api`                                      | 传输只有一个家               |
| `src/types.ts`                             | `shared/api/types.ts` 或域内 `model/`             | 类型跟着拥有者走             |
| `shared/components/<域>Panel.tsx`          | `modules/<域>/components/`                        | 带域语义的东西不许进 shared  |
| `modules/a/` 被 `modules/b/` import        | 提升到 `shared/components/common` 或由 `app` 组合 | 域间零依赖                   |
| `shared/hooks/useCrewX.ts`（只服务一个域） | `modules/crews/hooks/`                            | 单域编排不下沉 shared        |
| `modules/crews/api.ts`                     | `shared/api/crews.ts`                             | 传输层唯一                   |
| `shared/components/ui/×` 里用 hooks/stores | 挪 `shared/components/common/`                    | `ui/` 必须哑（依赖档位可判） |
| `modules/crews/styles.css`                 | 组件同名 `.module.css`                            | 样式唯一出处                 |
| `../..` 相对越级                           | `@/…`                                             | 一条 import 规则             |
| 新目录 `src/features/`                     | 不存在这个位置                                    | 目录白名单                   |

### 4.7 命名契约

| 类别      | 规则                                                                            |
| --------- | ------------------------------------------------------------------------------- |
| 目录      | 全小写单词/复数；禁下划线、大写、中文；域名 = 后端资源族名（对齐 `CONTEXT.md`） |
| 组件文件  | `PascalCase.tsx`；页面 `*Page.tsx`                                              |
| 非组件 TS | `camelCase.ts`；hook 必须 `use*.ts`                                             |
| 端点文件  | 资源名：`crews.ts`、`toolEndpoints.ts`                                          |
| store     | `<名词>.ts` 且导出 `use<名词>Store`                                             |
| 样式      | 与组件同名同目录 `*.module.css`；类名 camelCase                                 |
| 测试      | `*.test.ts(x)` 与源文件同目录                                                   |

---

## 5. 规则清单

规则 ID：`S` 结构 / `D` 设计系统 / `C` 文案 / `P` 依赖 / `H` 反退化。
等级 = 判定等级；级别 = error / warn。

### 5.1 结构与边界（S）

| ID  | 红线                                                                                    | 判据        | 等级  | 级别       |
| --- | --------------------------------------------------------------------------------------- | ----------- | ----- | ---------- |
| S01 | `src` 下只许 `app/` `modules/` `shared/` + `*.d.ts`；每层子项在角色表内                 | 目录白名单  | L1    | error      |
| S02 | 目录深度 ≤3（相对 `src`）；域槽位内禁再嵌套                                             | 路径        | L1    | error      |
| S03 | 文件必须落在某个槽位（域根只许 `routes.tsx`）                                           | 路径        | L1    | error      |
| S04 | 域内 import 只许 `./`、`@/modules/<自己>`、`@/shared`、第三方                           | import 前缀 | L3    | error      |
| S05 | 域外只许 `import '@/modules/<域>/routes'`                                               | 图          | L3    | error      |
| S06 | `views/` 对域外私有                                                                     | 图          | L3    | error      |
| S07 | `shared` 线性层序                                                                       | 图          | L3    | error      |
| S08 | 全图无环                                                                                | 图 DFS      | L3    | error      |
| S09 | `app/layouts` 不得 import `modules/**`                                                  | 图          | L3    | error      |
| S10 | 禁相对越级 `../`                                                                        | import 前缀 | L2    | error      |
| S11 | 禁 barrel / `export *`                                                                  | AST         | L2    | error      |
| S12 | 命名契约（目录/文件/导出名，§4.7）                                                      | 路径 + AST  | L1+L2 | error      |
| S13 | 导出形态契约（§4.5）                                                                    | AST         | L2    | error      |
| S14 | 有 `views/` 必须有 `routes.tsx`                                                         | 路径        | L1    | error      |
| S15 | 无孤儿文件；域 `routes` 必被 `app/router` 聚合；每个 view 必被本域 `routes` 引用        | 可达性      | L3    | error      |
| S16 | 体积：文件 ≤400 / 视图与组件 ≤320 / 单组件函数 ≤150 / 单文件导出值 ≤6 / 单文件组件数 ≤3 | AST 计数    | L2    | error/warn |
| S17 | 同一导出名在两处定义（防复制粘贴实现）                                                  | AST         | L2    | warn       |
| S18 | `shared` 里的项只被一个域使用 → 应下沉域内                                              | 图入度来源  | L3    | warn       |

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

| ID  | 红线                                                                                                 | 判据                    | 等级 | 级别  |
| --- | ---------------------------------------------------------------------------------------------------- | ----------------------- | ---- | ----- |
| P01 | `dependencies` 必须在选型白名单内（对齐 `AGENTS.md` 选型表）                                         | `package.json`          | L1   | error |
| P02 | 明确禁用库（axios/ky/swr/redux/mobx/jotai/react-hook-form/tailwind/styled-components…）              | `package.json`          | L1   | error |
| P04 | **适配表与实际依赖一致**：适配表声明的包必须在 `dependencies` 里；反向，装了适配表之外的组件库即报错 | 适配表 + `package.json` | L1   | error |
| P05 | **图标来源唯一**：图标 import 只许来自适配表登记的图标包                                             | 适配表 + AST            | L2   | error |
| P03 | 幽灵依赖：import 了未声明的包                                                                        | 图 + `package.json`     | L3   | error |

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
// arch.config.mjs —— 唯一导入面（抽取成包时只改这一行，见 §15.4）
import {
  canonical,
  designSystem,
  copy,
  deps,
  hygiene,
  uiKit,
  antdKit,
} from './tools/arch-guard/index.mjs'

export default {
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
    thresholds: { fileLines: 400, componentLines: 320, functionLines: 150, exportsPerFile: 6 },
    semanticSlots: { requestPolicy: { keys: ['staleTime', 'retry', 'pageSize'] } },
  },
}
```

项目差异只写在 `overrides`；引擎与预设保持项目无关。

### 7.1 UI 组件库适配（可换、可不用）

**组件库是可选、可替换的配置轴，不是范式的一部分。** 引擎里不得出现任何具体库名。

**适配器契约** —— 每个字段驱动哪条规则：

| 字段               | 含义                                                    | 驱动的规则                               |
| ------------------ | ------------------------------------------------------- | ---------------------------------------- |
| `id`               | 适配器标识                                              | 报告与文档                               |
| `packages`         | 该库允许出现在 `dependencies` 的包名                    | P01 白名单、P04 一致性                   |
| `icons.from`       | 允许的图标来源包（唯一）                                | P05                                      |
| `vendorSelectors`  | 该库的 DOM 选择器前缀（如 `\.ant-`）                    | D10 / D10b                               |
| `vendorVars`       | 该库的 CSS 变量前缀（如 `^--ant-`）                     | D10 / D10b                               |
| `detachedApis`     | 脱离上下文的全局 API 与替代写法                         | H06                                      |
| `styleProps`       | 内联样式入口 prop 名（React `style`；MUI `sx` / `css`） | D15                                      |
| `themeIntegration` | 库主题映射的落点（CSS 目录 + JS 文件）                  | exclusiveOwner（S03 落点 + D10 边界）    |
| `policy`（可选）   | 组件来源阶梯、覆盖阶梯的文本                            | 只用于渲染 `ARCHITECTURE.md`，不参与红线 |

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

**元框架轴（本期范围）**：`metaFramework: 'react'` 是独立一轴。v1 只支持 React（parser 用 TSX，`hooks` / `views` / JSX 规则成立）；换 Vue / Svelte 需要换 parser 与整套规则集，属预留轴，不在本期。

### 7.2 其余可替换面（同类问题的一次性清查）

> **判据**：凡是「不改变架构、只改变写法」的选择，都是**可替换面**，必须有默认值 + 适配器；凡是「架构本身」的，写成不变量，不配置。

**（1）可替换面总表**

| #   | 可替换面            | 现在写死在哪                                                                | 换掉后崩什么                                                         | Tier          |
| --- | ------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------- |
| 1   | UI 组件库           | §7.1 适配表 ✅                                                              | —                                                                    | 已做          |
| 2   | **数据层**          | B3 Query 挂载点、C2 副作用禁取数、C3 mutation 必须失效缓存、S13 `use*Store` | 换 SWR / Jotai / Redux / Pinia / Vue Query → 规则识别不到触发点      | T1            |
| 3   | **路由模式与出口**  | 域公开面 = `routes.tsx`、paths 唯一出处、S15 routes 必被聚合                | Next / Remix / Nuxt 文件路由没有 `routes.tsx`                        | T1            |
| 4   | **样式方案**        | D16 自研样式只在 `*.module.css`、D17 双向契约                               | Tailwind 下 `@apply` 从「禁令」变「常态」；CSS-in-JS 没有 class 契约 | T1            |
| 5   | **i18n 形态**       | C 域全部按 `t('key')` + 两份 TS 嵌套对象                                    | `<FormattedMessage id>`、扁平 JSON、ICU 复数规则                     | T1            |
| 6   | 网络客户端          | B1 检测 `fetch / XHR / EventSource`                                         | 项目合法用 axios → B1 失去触发点                                     | T2            |
| 7   | 令牌来源            | D01–D07 全走 CSS 自定义属性                                                 | 令牌在 TS 对象（`theme.ts` / Style Dictionary）→ 扫描器读不到        | T2            |
| 8   | 主题机制            | `data-theme` 属性 + storage key                                             | class 切换、`prefers-color-scheme` 媒体查询                          | T2            |
| 9   | 装配与入口          | D08 校验 `index.html`；可达性入口 = `main.tsx`                              | Next / Nuxt 没有 HTML 模板                                           | T2            |
| 10  | 测试框架与布局      | `*.test.ts(x)` co-located 且豁免可达性                                      | Jest `__tests__/`、Playwright `e2e/` → 孤儿文件误报                  | T2            |
| 11  | 命名契约            | `*Page.tsx`、`use*`、`use*Store`                                            | 项目用 `*.view.tsx` / 自定义 hook 前缀                               | T2            |
| 12  | 导出风格            | views 必须 default export                                                   | 全 named export 的项目                                               | T2            |
| 13  | 硬编码文案判定      | 中文字符检测                                                                | 源语言是英文时失效 → 已改为 **C01「JSX 裸文本禁止」**（语言无关）    | T2 已缓解     |
| 14  | 依赖选型表          | P01「对齐 AGENTS.md 选型表」＝**两处真相**                                  | 表改了、config 没改 → 漂移                                           | T1（见 §7.3） |
| 15  | 时间库              | H10 建议 dayjs                                                              | date-fns / Temporal                                                  | T3            |
| 16  | 包管理器 / monorepo | 单包 + pnpm 锁文件                                                          | monorepo 需要多实例配置                                              | 范围外        |

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

## 8. 交付物清单

**本体（`tools/arch-guard/`，可整体抽取）**

| 交付物                      | 说明                                                                                                                                                               | 规模估计          |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------- |
| `package.json`              | 包清单：`private: true`、零 `dependencies`、`peerDependencies: typescript`、`bin`、`exports`                                                                       | ~30 行            |
| `index.mjs`                 | CLI 入口 + **唯一导入面**（re-export 预设 / 适配器 / data）                                                                                                        | ~80 行            |
| `src/**`                    | 引擎：scan / resolve / node / facts / graph / adapters / registry / baseline / report / self-test / render-docs                                                    | ~2000 行          |
| `packs/react/**`            | React 框架包：parser / 角色表变体 / 语言相关规则 / fixtures                                                                                                        | ~400 行           |
| `presets/**`                | 五个域预设 + T1 适配器（`ui-kits/{antd,none}`、`data-layers/{tanstack-query}`、`routers/{react-router}`、`styles/{css-modules}`、`i18n/{i18next}`）+ T2 默认值目录 | ~250 行 + 5×30 行 |
| `data/kit-fingerprints.mjs` | 已知组件库指纹（纯数据）                                                                                                                                           | ~60 行            |
| `__fixtures__/**`           | 规则回归样例（违规必报 × 合规不报）                                                                                                                                | ~40 个文件        |
| `PARADIGM.md`               | **通用范式规范：跟本体走**（抽取时一起搬）                                                                                                                         | ~250 行           |
| `README.md`                 | 接入说明 + 抽取清单 + 自包含不变式（P1–P3）                                                                                                                        | ~80 行            |

**项目实例（留在仓库，不进本体）**

| 交付物                                | 说明                                                   | 规模估计 |
| ------------------------------------- | ------------------------------------------------------ | -------- |
| `arch.config.mjs`                     | superhive 实例，唯一 import 面（约 60 行）             | ~60 行   |
| `arch.baseline.json`                  | 存量豁免（生成）                                       | —        |
| `ARCHITECTURE.md`                     | 本项目实例：目录契约、规则表、怎么跑                   | ~200 行  |
| `docs/adr/0004-architecture-guard.md` | 决策记录（为何可判定性优先）                           | ~60 行   |
| `AGENTS.md` 更新                      | 提交前检查 + 指向 `ARCHITECTURE.md`                    | 小改     |
| `package.json`                        | `lint:guard` / `guard:dev` 接线；**移除 `lint:theme`** | 小改     |
| `.agents/skills/ui-style/SKILL.md`    | 修掉过时的 kebab-case，指向新守卫                      | 小改     |
| `scripts/check-theme.mjs`             | **删除**（能力并入 design 域）                         | —        |

---

## 9. superhive 落地（第一个实例）

### 9.1 结构迁移

| 迁移项   | 内容                                                                                                                                                                                                                                                                                                                                                  |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 三根拓扑 | `@/api`→`@/shared/api`、`@/components`→`@/shared/components`、`@/hooks`→`@/shared/hooks`、`@/stores`→`@/shared/stores`、`@/theme`→`@/shared/theme`、`@/i18n`→`@/shared/i18n`、`@/config`→`@/shared/config`、`@/lib`→`@/shared/lib`、`@/assets/*.css`→`@/shared/styles/*`、`@/router`→`@/app/router`、`@/layouts`→`@/app/layouts`、`App/main`→`@/app/` |
| 规模     | 别名 import **116 行 / 38 文件**；`@/modules/*` 零改动；4 处 `../` 消除（机械 codemod + 全量 type-check）                                                                                                                                                                                                                                             |
| 路由分片 | 新增 `modules/<域>/routes.tsx`；`app/router/index.tsx` 降为 ~15 行聚合                                                                                                                                                                                                                                                                                |
| 唯一出处 | 新增 `shared/config/{paths,storage,env}.ts`；storage key 从 stores/theme/i18n 三处收敛                                                                                                                                                                                                                                                                |
| i18n     | 改为「一命名空间一文件」，两份语言目录同构                                                                                                                                                                                                                                                                                                            |
| 样式     | `assets/*.css` → `shared/styles/{tokens,vendor}`；`shared/components/ui` 收紧为哑件（`SpaceSwitcher` 等挪 `common/`）                                                                                                                                                                                                                                 |

### 9.2 与旧 `check-theme.mjs` 的对照（零覆盖损失）

| 旧检查                                | 新规则    |
| ------------------------------------- | --------- |
| 写死颜色                              | D01       |
| 色板唯一出处 / 色值唯一               | D02 / D03 |
| 引用完整 / 无死令牌                   | D04 / D05 |
| 双主题齐全                            | D06       |
| 对比度基线                            | D07       |
| storage key 一致（index.html）        | D08       |
| 禁 `!important` / `.ant-*` 只许两文件 | D09 / D10 |
| 无框架残留                            | D11 + P02 |
| 中英键一致 / `THEME_MODES` 键         | C03 / C02 |

**顺带新增覆盖**（旧守卫没查、ui-style 写了但没人执行的）：D12–D15（长度/层级/时长/内联尺寸的魔法数字）、D16（自研样式只在 module.css）、D17（CSS Module 双向契约）、D18（只消费语义令牌）、C01（中文明文）、C02/C06（键存在与死键）。

命令形态：`lint:guard` 是唯一入口；`lint:theme` 与 `scripts/check-theme.mjs` 退役（需要肌肉记忆时加不匹配 `lint:*` glob 的 `guard:design`）。**不能同时保留 `lint:theme` 与 `lint:guard`** —— `run-s "lint:*"` 会让 design 域跑两遍。

### 9.3 存量债

迁移后跑一次 `--update-baseline`：预期条目 —— `../` 4、裸 fetch 1、localStorage 直连 6、`stores/auth`→api 值、`api/queryClient`→stores、路由字面量若干、default export（layouts/router/components）、内联样式裸数字若干、中文明文 1、`ChatSession.tsx` 378 行、i18n 死键。**规则不迁就现状**，这些全部落在 baseline 里可见、可逐条清偿。

### 9.4 接线与文档

- `package.json`：`lint:guard`（`run-s "lint:*"` 自动纳管），移除 `lint:theme`。
- `AGENTS.md`：提交前改为「`pnpm lint`（含架构守卫）+ `pnpm type-check`」；`ui-style` 与 `THEME-ARCHITECTURE.md` 的守卫指针改指 `lint:guard --domain=design`；补一行「新增文件/目录/依赖前读 `ARCHITECTURE.md`」。
- `docs/adr/0004-architecture-guard.md` 记录「可判定性优先」这条不可回退的选择。

---

## 10. 分期

| 阶段             | 内容                                                                                                                            | 完成标志                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| P0 骨架          | `scan/resolve/node/parse/graph/ctx` + 角色表互斥完备自检 + self-test 框架 + 引擎零项目字面量自检 + UI 组件库适配器加载 + 指纹表 | 在 superhive 上跑通空规则集，耗时 <300ms |
| P1 L1 规则       | S01–S03、S10、S12、S14、D10、D16、P01–P02、命名与配对                                                                           | 违规样例被拦，合规样例不报               |
| P2 L2 规则       | S11、S13、S16–S17、D01–D03、D06、D09、D11–D15、D17–D18、C01、C04、H01–H10                                                       | 同上 + fixtures 齐全                     |
| P3 L3 规则       | S04–S09、S15、S18、D04–D05、C02–C03、C05–C06、P03                                                                               | 依赖图规则全绿                           |
| P4 design 域整合 | 迁移旧守卫 11 条 + 对比度 metric + `--domain=design` 等价验证                                                                   | 旧守卫与新守卫结论逐条一致               |
| P5 接线与迁移    | `lint:guard` 接入、baseline、文档、三根拓扑 codemod、（可选）结构迁移                                                           | `pnpm lint` + `pnpm type-check` 全绿     |
| P6 可搬运验证    | 引擎复制到最小样例工程跑通并拦住违规                                                                                            | 样例工程零配置通过，违规被拦             |

---

## 11. 验收标准

1. `pnpm lint:guard` 在 superhive 通过（含 baseline），`--report` 输出可读且带修法。
2. `--domain=design` 与旧 `check-theme.mjs` **结论逐条等价**（§9.2 对照表为验收清单）。
3. `--self-test` 全绿：每条规则违规必报、合规不报。
4. 元自检通过：角色表互斥完备；引擎/presets 零项目字面量。
5. 故意违规样例（每个域至少一条）确实被拦。
6. 引擎复制到最小样例工程可跑通（证明可搬运）。
7. `pnpm lint` + `pnpm type-check` 全绿；**零新增运行时依赖**。

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

## 13. 待拍板

| #   | 问题                                                                                         | 我的建议                                                                                                                                                 |
| --- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 目录拓扑：三根 `app/modules/shared` / 平铺但严格                                             | 三根（域内 import 规则塌缩成一句话）                                                                                                                     |
| 2   | i18n：分片（一命名空间一文件）/ 维持两文件                                                   | 分片（「键属于谁」才能在 L1 判定）                                                                                                                       |
| 3   | `check-theme.mjs`：退役并入 / 双跑一段时间                                                   | 退役并入（双跑会让 design 域跑两遍）                                                                                                                     |
| 4   | 存量：baseline 棘轮 / 直接修完                                                               | 棘轮（规则不迁就现状，欠债可见可清偿）                                                                                                                   |
| 5   | 本轮范围：只交付引擎+配置+文档+baseline / 连结构迁移一起做                                   | 先交引擎与接线，结构迁移单独一轮（codemod 风险独立评审）                                                                                                 |
| 6   | 是否发 npm 包                                                                                | **先做成「可抽取的包形态」**：本体独立在 `tools/arch-guard/`、自带 `package.json`（private）、出口唯一导入面，抽取时只改 config 一行（见 §15）；暂不发布 |
| 7   | 组件库适配器：只做 `antd` + `none`，还是连 `mui`/`element` 骨架一起给                        | 先做 `antd` + `none`（契约已固定，换库 30 行）；骨架按需补                                                                                               |
| 8   | 元框架：v1 只 React，还是现在就要 Vue / Svelte；若只 React，是否**现在**就把 pack 边界划出来 | 只 React，但 v1 就划 pack 边界（多约 1 天，将来加 Vue 是加法而非重写，见 §7.5）                                                                          |
| 9   | 适配器范围：只做 uiKit / T1 五个 / T1+T2 全给                                                | T1 五个（uiKit、数据层、路由、样式、i18n）—— 不做的话「可搬运」是假的；T2 留目录与默认值，不阻塞                                                         |
| 10  | 文档同源：`--render-docs` 管理块 + `--check-docs` CI 校验 / 全手写文档                       | 管理块（选型表、目录契约、规则清单都从配置渲染，漂移变红线）                                                                                             |

---

## 14. 架构自审（健壮性 / 可扩展性）

Status: 2026-09-23 审核，共 18 项 —— P0 必修 5（R1–R5）、健壮性缺口 7（R6–R12）、扩展性缺口 6（E1–E6）。

### 14.1 强项（骨架，不动）

可判定性优先（红线只落 L1–L3）让「零误报」有依据；适配器=数据 + 能力协商让换库/不用库不动引擎；角色表互斥完备 + 三条元自检让结构本身可证明。

### 14.2 P0 必修（不修则上线即出事）

| ID     | 缺陷                                                                                                                                | 后果                                                                                                                                                                    | 修法                                                                                                                                                                      |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **R1** | **跨域组合没有合法落点**：S05/S06 规定域外只能 import `routes.tsx`，§4.6 又说跨域「由 app 组合」，但 app 也只能 import `routes.tsx` | 真实需求（如 `SessionsPage` 同时要 chat 与 crews）无合法位置 → 逼出绕过：组合逻辑塞进 `shared/components/common`，shared 长成隐形模块层，域边界从内部烂掉               | **域公开面 = `routes.tsx` + `index.ts`**（显式对外契约，禁 `export *`、受体积与导出面上限约束）；跨域组合一律发生在 `app/`；`index.ts` 只许被 `app/**` 引用，域间仍零依赖 |
| **R2** | **解析失败会静默失去全部检查**                                                                                                      | 解析异常若被 catch 后跳过，该文件不受任何规则检查，门禁照样报绿                                                                                                         | **fail closed**：解析失败即文件级 error；引擎自身异常 exit≠0；禁止「跳过并继续」                                                                                          |
| **R3** | **与 `pnpm lint` 的 fixer 相互作用**：`run-s "lint:*"` 内含 `oxlint --fix` / `eslint --fix`，而 baseline 锚点是行文本哈希           | fixer 顺手格式化一行 → 豁免失效 → 整仓爆红                                                                                                                              | ① 分阶段：`lint` = `run-s lint:fixers lint:guard`（guard 不与 fixer 混跑）；② 锚点改用格式化不敏感的规范化哈希                                                            |
| **R4** | **豁免通道缺「正当例外」出口**：只有 config 白名单（粗到整文件）与 baseline（语义=存量债）                                          | 合法永久例外（全局错误边界的 `console.error`、第三方类型 bug 的 `@ts-expect-error`）只能塞 baseline → 把「有意为之」记成「欠债」，review 分不清且「只减不增」永远减不掉 | **加第三通道：结构性例外** = 内联注释 + 强制 `reason` + 到期时间；门禁统计并列出每个 PR 新增例外数。把「禁内联豁免」改为「内联豁免必须带理由与期限、且被计数」            |
| **R5** | **行哈希锚点对多行/文件级违规不成立**                                                                                               | S16（文件 400 行）、S15（孤儿文件）、D05（死令牌）、C06（死键）没有「那一行」                                                                                           | 按规则定义锚点形态：单行→规范化行哈希；文件级→路径 + 违规签名（导出名集合 / 规模档位）；符号级→符号名（令牌名 / 键名）                                                    |

### 14.3 健壮性缺口

| ID  | 缺口                                                   | 后果                                  | 修法                                                                                                                                                            |
| --- | ------------------------------------------------------ | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R6  | 无**豁免域**（生成代码 / 三方 / e2e / 迁移脚本）       | 接进第一条生成的 API 代码就把门禁推翻 | `exempt: [{ glob, reason, rules }]` + 生成物必须带 `@generated` 标记（可证伪）                                                                                  |
| R7  | 无增量与缓存；`run-s lint:*` 每轮全量                  | 开发环变慢 → 门禁被关掉               | **已设计见 §6.8**：facts 按文件缓存（键含规则集/配置/ts/适配器版本），图与全局谓词每轮重建；`--changed` / `--staged` / `--since` / `--local-only`；CI 必须 full |
| R8  | 别名两处来源（tsconfig `paths` vs vite `alias`）       | 图解析静默失败 → 孤儿误报/漏报        | 别名唯一出处 + `--check-aliases`                                                                                                                                |
| R9  | **规则谓词未全部可执行**（「字面量 const」「纯函数」） | 实现时各写各的 → 误报                 | 元规则：每条规则必须给出可执行判据；形容词不许进规则表                                                                                                          |
| R10 | 引擎自身不在守卫范围内                                 | 引擎腐化无人管                        | 用同一套守卫跑 `tools/arch-guard/**`（自用配置）                                                                                                                |
| R11 | `shared/components/common` 允许 `import type` 契约类型 | 业务语义进 shared，域边界被侵蚀       | 收紧：`common/` 禁 import `shared/api/types`                                                                                                                    |
| R12 | 文档生成块的合并冲突与手改成本                         | CI 报错难懂、多 agent 冲突            | 只对易漂移小块（选型 / 阈值）生成，其余手写 + 弱校验（引用 ID 存在）                                                                                            |

### 14.4 可扩展性缺口

| ID  | 缺口                                                                                         | 修法                                                                                                                  |
| --- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| E1  | **规则注册契约未定义**（id / domain / level / severity / requires / docs / hint / fixtures） | `defineRule()` + registry 校验：唯一 id、**error 必须 L1–L3**（把核心原则从散文变成代码）、必须有 fixtures 与修法提示 |
| E2  | 适配器面清单硬编码在引擎                                                                     | 面表数据化：`facets.mjs` 声明 `{ name, schema, capabilities }`，加面 = 加一个文件                                     |
| E3  | pack 只有职责描述、**没有接口**                                                              | 定义 `definePack()` 契约，用 React pack 验证，留 stub pack 做契约测试                                                 |
| E4  | 只有适配器有 `specVersion`                                                                   | config / baseline / 规则集 都带版本；不兼容给 codemod 提示而非静默行为变化                                            |
| E5  | 无规则退役机制                                                                               | `--stats`（每条规则命中数）+ `since`；长期零命中 → warning 提议退役                                                   |
| E6  | 无机器可读输出、无按需检查                                                                   | `--format=json`（供 agent 消费）+ `--changed`                                                                         |

### 14.5 诚实边界

门禁约束的是**形态**（放哪、能依赖谁、真相几份、有没有退路），不约束**质量**（抽象是否重复、域划分是否合理、命名是否恰当）。「零误报」是靠「只落 L1–L3」换来的，代价是存在**合法绕过空间** —— 把业务逻辑塞进 `shared/lib` 的一个纯函数文件即可通过绝大多数规则。因此 **R9（判据可执行）与 E5（命中统计）是把「绕过」与「规则空转」变可见的关键**，不是可选项；门禁必须与 review 配对。

### 14.6 折入范围

- R1、R3、R4 **改动既有决定**（域公开面、豁免通道、lint 编排），需先拍板再改 §4.4 / S05 / S06 / §3.4 / §9.4。
- R2、R5、R6–R12、E1–E6 作为 spec 修正直接落。

---

## 15. 门禁本体的归属与抽取

**要求**：门禁相关代码全部放在一个目录里，项目只留实例；本体可在后续单独开项目（抽成独立包）。

### 15.1 归位：本体一个目录，项目三个文件

```
tools/arch-guard/                  ← 门禁本体（唯一代码目录，可整体复制 / 抽取）
  package.json                     ← 包清单：private: true、零 dependencies、peer: typescript
  index.mjs                        ← CLI 入口 + **唯一导入面**（re-export 预设与适配器）
  src/                             ← scan / resolve / node / facts / graph / adapters / registry
                                     / baseline / report / self-test / render-docs
  packs/react/**                   ← 框架包（parse + 角色表变体 + 语言相关规则 + fixtures）
  presets/{canonical,design-system,copy,deps,hygiene}.mjs
  presets/{ui-kits,data-layers,routers,styles,i18n}/<name>.mjs
  data/kit-fingerprints.mjs
  PARADIGM.md                      ← **通用范式规范：跟本体走**（抽取时一起搬）
  README.md                        ← 接入说明 + 抽取清单
  __fixtures__/**

arch.config.mjs                    ← 项目实例（约 60 行，唯一 import 面）
arch.baseline.json                 ← 项目存量豁免（**项目状态，不进本体**）
ARCHITECTURE.md                    ← 项目架构说明（人 / agent 读，指向 PARADIGM.md）
docs/adr/0004-architecture-guard.md← 项目决策记录
```

**镜像原则**：本体只装「通用能力」，不装项目事实；项目只装「项目事实」，不装门禁逻辑。`PARADIGM.md` 属于本体（它是工具的规范），`ARCHITECTURE.md` 属于项目（它是这个仓库的实例）。

### 15.2 本体自包含：三条可机检的不变式

| ID     | 不变式                                                                  | 判据                                                                            |
| ------ | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **P1** | 本体只许 import `node:*`、`typescript`、本体目录内的相对路径            | 本体 import 图；出现 `@/…`、`../..` 出目录、或任何其他第三方包即 error          |
| **P2** | 本体不得出现项目字面量（项目路径、令牌前缀、语言 ID、域名词、组件库名） | 字符串扫描 + 白名单（组件库名只许在 `presets/ui-kits/*`，指纹只许在 `data/**`） |
| **P3** | 本体只通过 `--config` + `cwd` 获得项目事实                              | 代码里不得硬编码 `arch.config.mjs` / `tsconfig.json` / `package.json` 路径      |

由 `--self-check-portability` 执行，纳入 `--self-test` 与 CI。**这三条是"可抽包"从口号变成事实的关键。**

### 15.3 入口与配置注入

```bash
node tools/arch-guard/index.mjs --config ./arch.config.mjs --scope=full
```

默认在 `cwd` 找 `arch.config.mjs`；找不到就明确报错，**不回退、不猜**。本体不假设仓库布局 —— `src/`、`shared/` 等路径全部来自 `layout` 表。

### 15.4 抽取不变量：抽包只改 config 的 1 行

config 只从唯一导入面取东西：

```js
// 现在（本仓库内）
import {
  canonical,
  designSystem,
  copy,
  deps,
  hygiene,
  uiKit,
  antdKit,
} from './tools/arch-guard/index.mjs'
```

```js
// 抽取后（只改 specifier）
import { canonical, designSystem, copy, deps, hygiene, uiKit, antdKit } from '@arch-guard/core'
```

`index.mjs` re-export 预设、适配器与 `data`；`package.json` 的 `exports` 同时暴露子路径（`./ui-kits/antd` 等）供高级用法。

**不新增 workspace、不改安装形态**：本体现在**不是** pnpm workspace 成员，`package.json` 只作包声明（`private: true`），不参与安装。（当前 `pnpm-workspace.yaml` 没有 `packages:` 字段，只承载 pnpm 设置，仓库不是 monorepo。）将来若想在本仓库内按包名自引用，再往 `pnpm-workspace.yaml` 加 `packages: ['.', 'tools/*']`。

### 15.5 抽取清单（6 步）

1. `git subtree split -P tools/arch-guard -b arch-guard-standalone`（保留历史）
2. 翻 `private: false`，填 `version` / `repository` / `license`
3. 在空仓库里跑本体的 `--self-test` 与 `--self-check-portability`（证明零项目耦合）
4. `PARADIGM.md` 作为包主页文档
5. 宿主项目 `pnpm add -D @arch-guard/core`，config 改 1 行 import
6. `lint:guard` 从 `node tools/arch-guard/index.mjs` 换成 `arch-guard`（bin 入口）

### 15.6 验收（把「可抽包」变成可证）

- **空目录测试**：把 `tools/arch-guard/` 复制进一个最小样例工程，`node index.mjs --config ./arch.config.mjs` 跑通并拦住违规（§11 #6）。
- **反向测试**：往本体里塞一条项目字面量（如某个 `@/shared/...` 路径），`--self-check-portability` 必须报错。
- **零依赖断言**：本体 `package.json` 的 `dependencies` 必须为空（CI 校验）。

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

1. 数据表（已完成：`wheel-fingerprints.ts`）
2. P09/P06（强指纹 + 能力库使用检查）→ 可立即产生价值
3. P10/P01（依赖白名单 fail-closed）
4. P07/P08（弱指纹 + 命名指纹、死依赖）
5. `--verify-deps`（联网，可选）

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
