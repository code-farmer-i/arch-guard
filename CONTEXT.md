# arch-guard

把架构约束写成**可判定不变量**的编码门禁。本体是通用引擎 + 数据表，宿主项目只提供一张配置表。

## Language

### 核心对象

**本体（tool）**：
本仓库自身 —— 引擎、框架包、预置、数据表，以 npm 包发布。依赖是显式登记的审查门（P1）；引擎不绑宿主与布局（P2/P3），所以换宿主只改 `arch.config.mjs`。
_Avoid_: 引擎（那是本体的一个层）、插件、框架

**宿主（host）**：
被检查的项目。它只见 `arch.config.mjs`，不接触本体源码。
_Avoid_: 项目、使用方、用户

**事实模型（facts）**：
parser 产出的纯 JSON：imports / exports / strings / jsxText / calls / catches / functions / comments。规则只消费它，从不接触 AST。
_Avoid_: AST、语法树、解析结果

**角色表（role table）**：
「路径 glob → 角色 → 允许的导出形态 + 依赖档位」。每个源文件必须**恰好命中一个角色**：命中 0 个是无处安放，≥2 个是歧义。
_Avoid_: 目录约定、分层表、白名单

**预置（preset）**：
贡献角色表 / 阈值 / 适配器 / 规则集的数据包。`canonical()` 是应用范式，`library()` 是库范式。
_Avoid_: 模板、profile、配置

**框架包（pack）**：
一种**源码形态**的落地：parser + 角色表变体 + 语言相关规则 + fixtures。`framework` 指形态（`typescript` / `react` / `vue` …），
不是"用了哪个框架"；一个项目只允许一个。v1 有 `tsPack`（框架无关的 TS/JS）与 `reactPack`，**两者今天共用同一份规则集**。
_Avoid_: 适配器（那是数据，pack 是代码）、元框架（那是形态轴上的旧叫法）

**适配器（adapter）**：
**数据，不是插件**：声明一个可替换面的库事实（包名、选择器前缀、全局 API、样式入口）。引擎从不回调它。
_Avoid_: 插件、驱动、集成

**适配面（facet）**：
可替换面的种类：`ui-kit` / `data-layer` / `router` / `styles` / `i18n`。
_Avoid_: 维度、类别

**页面级（pageLike）**：
角色描述符上的标记：这个角色是"页面"这一级的单元，S16 用 `thresholds.viewLines` 判它（其余用 `fileLines`）。
由**角色表**声明而不是规则猜 —— 猜的代价是 library / FSD 下 `viewLines` 配了不生效。
_Avoid_: 靠 `slot === 'views'` 推断

**槽位语义（structure.slots）**：
参数型能力：本范式的角色带槽位（views / hooks / model / lib）。canonical 声明它，library 与 fsd 没有 ——
S13 因此在那两个范式下**明列停用**，而不是注册了却永远判不出东西。
_Avoid_: 注册了空转的规则、`--explain` 承诺没在跑的判定

### 判定与证据

**判定等级（L1–L5）**：
L1 路径 / L2 单文件 AST / L3 依赖图 / L4 类型 / L5 语义。error 级红线只许落在 L1–L3，由 `createRule()` 代码强制。
_Avoid_: 严重度（那是 error/warn）、优先级

**检测原语（primitive）**：
十条可复用的判据形态（`exclusiveOwner` / `mustReference` / `referenceIntegrity` …）。规则都是它们的组合。
**这是分类词汇，不是引擎里的一层** —— 实现里没有 primitives 模块，可机检的锚点是「规则契约（`createRule`）+ 每条规则的夹具对」。
_Avoid_: 规则类型、检查器、DSL

**全局谓词（global predicate）**：
必须全项目求值才成立的判据（唯一性、可达性、无环）。这类发现项带 `global` 标记，在 `--scope=changed` 下默认仍然失败。
_Avoid_: 跨文件规则

**指纹（fingerprint）**：
「手工轮子」的可判定形态：`syntax` 强指纹单证据即报，`apiNames` 命名指纹需叠加。数据在 `data/wheel-fingerprints.ts`。
_Avoid_: 模式、签名、规则

**能力（capability）**：
项目声明的一个动作类别 → 首选方案，例如 `datetime: 'dayjs'`。能力表是选型表的机读真相，**但它不是依赖批准清单**：能力表只驱动 P06（命中手搓指纹必须用首选方案）。
_Avoid_: 特性、功能、依赖、白名单

**批准清单（allowlist）**：
`deps({ allow })`：项目运行时依赖的**完整**集合，非空才开启 P01（未登记即拒）。与能力表是两件事 —— 只声明能力不会把它打开（[ADR-0005](./docs/adr/0005-allowlist-is-explicit.md)）。
_Avoid_: 白名单、选型表（与能力表、`exceptions` 混淆）

**能力协商（capability negotiation）**：
规则声明 `requires`；适配器没声明的能力，对应规则**不注册**（而不是注册后再跳过）。
_Avoid_: 条件加载、开关

### 阈值与豁免

**例外（exception）**：
唯一的宽松通道：配置里的 `exceptions: [{ rule, glob, reason, expires? }]` —— 声明「**这条规则**对**这类文件**不适用」，
**不是「文件免检」**。`reason` 必填、`rule` 必须存在、`expires` 过期即红；每次运行都会点名。
**没有违规基线、没有文件级豁免、没有内联豁免注释。**
_Avoid_: 基线、棘轮、白名单、忽略、跳过、disable

**覆盖率棘轮（coverage ratchet）**：
M04 的机制：与覆盖率快照（`arch.coverage.json`）比，不许倒退。它**不豁免违规** —— 与豁免是两件事。
_Avoid_: 基线（那是已移除的违规存量机制）

### 运行范围

**scope（检测范围）**：
`full` / `changed` / `staged` / `since:<ref>`。**只过滤报告，不过滤正确性** —— facts 按文件缓存，图与全局谓词每轮全量重建。
_Avoid_: 增量模式、diff 模式

**忽略层（三层叠加）**：宿主 `ignore`（显式）· `.gitignore`（git 判定，只作用于契约域外）· 通用产物目录（数据表兜底）。
三层跳过什么都要自述。_Avoid_: 把它们混成一份名单

**契约扫描域（include）**：
「哪片树属于契约」的声明：只有命中 `include` 的 ts/css 参与角色判定与逐文件规则。域外文件仍进依赖图
（角色记为 `(outside)`），但不报「不在目录契约内」。默认由预设给出（应用/库范式都是源码根）。
_Avoid_: 白名单、扫描范围（那是 `scope`）、`ignore`（那是契约内的豁免）

### 工程形态

**应用范式 / 库范式**：
同一引擎量两类工程：`canonical()` 是应用（三根拓扑：装配 / 业务域 / 共享），`library()` 是库或 CLI（入口 / 引擎 / 预置 / 数据）。差异只在预置贡献的角色表与规则集。
_Avoid_: 项目类型、模板

**域（domain）**：
规则的五个分组：S 结构 / D 设计系统 / C 文案 / P 依赖 / H 反退化。规则 id 的首字母即域字母。
_Avoid_: 类别、模块
