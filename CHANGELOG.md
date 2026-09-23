# Changelog

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 与语义化版本。

## [Unreleased]

### Added

- **引擎骨架（P0）**：配置加载（预设合并 + tsconfig 别名单一出处）、目录扫描与角色表（互斥完备自检）、TS 事实模型（parser-only，规则不接触 AST）、import 图（含动态 import 与 CSS `@import`/`composes`）、能力协商注册表、棘轮基线（行文本哈希锚点）、报告（pretty / json）、检测范围 scope（full / changed / staged / since）。
- **规则**：结构域 S00–S16（解析失败 fail-closed、目录契约、深度、相对越级、barrel、命名、导出形态、域路由必填、体积），反退化域 H01–H05（类型逃生舱、suppression、调试残留、未完成标记、吞异常）；共 14 条。
- **适配器**：`defineAdapter` 字段白名单与样例校验、UI 组件库适配器（`antdKit` / `noneKit`）、组件库指纹数据（换库残留验收）。
- **本体自包含检查**：P1 依赖白名单 / P2 宿主字面量 / P3 引擎无布局假设（`--self-check-portability`）。
- **夹具回归**：`--self-test`，三个夹具（合规零误报 / 10 条违规全报 / 坏语法 fail-closed）。
- **构建与发布链路**：`pagoda-cli build`（lib 模式、保留模块结构）→ `es/` ESM + `.d.ts`，`private: false` 可发布形态；ESM-only（CJS 产物的相对路径与 `.js` 规范不兼容，见 docs/SPEC.md）。
- **库 / CLI 范式**：`presets/library.ts`（库角色表 + 库适用规则集），本体用自己跑狗粮（`pnpm guard:self`）；据此修正三处规则精度（H04 字符串判据收紧、S11 放行 `export type *`、hygiene 不再抢规则选择权）并让配置豁免在报告里可见。
- **选型纪律（设计）**：`data/wheel-fingerprints.ts`（能力表 + 强/弱指纹 + 库 API 名），PARADIGM §12 / SPEC §16。
- **文档**：`PARADIGM.md`（通用范式，可整篇搬到别的仓库）、`docs/SPEC.md`（完整设计与架构自审）、`README.md`。
