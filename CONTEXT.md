# arch-guard

把架构约束写成**可判定不变量**的编码门禁。本体是通用引擎 + 数据表，宿主项目只提供一张配置表。

## Language

### 核心对象

**本体（tool）**：
本仓库自身 —— 引擎、框架包、预置、数据表。除 `commander` 外无运行时依赖，可整目录搬进任何 TS 仓库。
_Avoid_: 引擎（那是本体的一个层）、插件、框架

**宿主（host）**：
被检查的项目。它只见 `arch.config.mjs` 与 `arch.baseline.json`，不接触本体源码。
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
换元框架才需要的东西：parser + 角色表变体 + 语言相关规则 + fixtures。v1 只有 React。
_Avoid_: 适配器（那是数据，pack 是代码）

**适配器（adapter）**：
**数据，不是插件**：声明一个可替换面的库事实（包名、选择器前缀、全局 API、样式入口）。引擎从不回调它。
_Avoid_: 插件、驱动、集成

**适配面（facet）**：
可替换面的种类：`ui-kit` / `data-layer` / `router` / `styles` / `i18n`。
_Avoid_: 维度、类别

### 判定与证据

**判定等级（L1–L5）**：
L1 路径 / L2 单文件 AST / L3 依赖图 / L4 类型 / L5 语义。error 级红线只许落在 L1–L3，由 `createRule()` 代码强制。
_Avoid_: 严重度（那是 error/warn）、优先级

**检测原语（primitive）**：
十条可复用的判据形态（`exclusiveOwner` / `mustReference` / `referenceIntegrity` …）。规则都是它们的组合。
_Avoid_: 规则类型、检查器

**全局谓词（global predicate）**：
必须全项目求值才成立的判据（唯一性、可达性、无环）。这类发现项带 `global` 标记，在 `--scope=changed` 下默认仍然失败。
_Avoid_: 跨文件规则

**指纹（fingerprint）**：
「手工轮子」的可判定形态：`syntax` 强指纹单证据即报，`apiNames` 命名指纹需叠加。数据在 `data/wheel-fingerprints.ts`。
_Avoid_: 模式、签名、规则

**能力（capability）**：
项目声明的一个动作类别 → 首选方案，例如 `datetime: 'dayjs'`。能力表是选型表的机读真相。
_Avoid_: 特性、功能、依赖

**能力协商（capability negotiation）**：
规则声明 `requires`；适配器没声明的能力，对应规则**不注册**（而不是注册后再跳过）。
_Avoid_: 条件加载、开关

### 阈值与豁免

**棘轮（ratchet）**：
存量违规进基线，条目 = 规则 + 文件 + 稳定锚点。被豁免那行一改，豁免立即失效；基线只减不增。
_Avoid_: 忽略清单、白名单、suppress

**锚点（anchor）**：
基线条目的稳定标识：单行取规范化行文本哈希，文件级 / 符号级由规则给出签名。
_Avoid_: 哈希、key、签名

**豁免（exemption）**：
只有两条官方通道：配置里的 `exempt` 白名单（必须写理由）与基线。没有内联豁免注释。
_Avoid_: 忽略、跳过、disable

### 运行范围

**scope（检测范围）**：
`full` / `changed` / `staged` / `since:<ref>`。**只过滤报告，不过滤正确性** —— facts 按文件缓存，图与全局谓词每轮全量重建。
_Avoid_: 增量模式、diff 模式

### 工程形态

**应用范式 / 库范式**：
同一引擎量两类工程：`canonical()` 是应用（三根拓扑：装配 / 业务域 / 共享），`library()` 是库或 CLI（入口 / 引擎 / 预置 / 数据）。差异只在预置贡献的角色表与规则集。
_Avoid_: 项目类型、模板

**域（domain）**：
规则的五个分组：S 结构 / D 设计系统 / C 文案 / P 依赖 / H 反退化。规则 id 的首字母即域字母。
_Avoid_: 类别、模块
