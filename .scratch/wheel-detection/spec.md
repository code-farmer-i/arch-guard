# 手搓轮子检测补全（P07 + 指纹覆盖）

Status: ready-for-agent

## 背景与问题

P06 只认**强指纹**（形态无歧义，如 `JSON.parse(JSON.stringify(x))`、`date.getFullYear()`）。于是两类轮子抓不到：

1. 自己写了一个 `debounce`，形态是 `setTimeout` + `clearTimeout` —— 弱指纹，单证据会误伤正常定时器。
2. 自研模块导出了 `deepClone` / `formatDate` / `validateEmail` 这类**与成熟库 API 同名的函数** —— 这是命名证据，不是形态证据。

另外指纹表目前由本体自带，项目无法覆盖：宿主想收紧（企业规范只认某个库）或放宽（内部自研库已很成熟）都做不到。

## 目标

- 弱指纹 + 命名指纹**两个证据同时成立**时，报 P07（warn），不单证据报。
- 宿主可在 `arch.config.mjs` 覆盖单个能力的指纹（加/删 pattern、改首选方案），覆盖后的表仍需通过 `defineAdapter` 式校验。
- 每条新判据都有「违规必报 × 合规不报」夹具。

## 非目标

- 不做"这段代码是不是重复造轮子"的语义判断（L5，永远不进红线）。
- 不联网判定库的成熟度 —— 那是独立的 `--verify-deps`，单独一张票。

## 验收标准

- `pnpm self-test` 新增夹具 `wheel-soft`：同一文件里 `setTimeout`+`clearTimeout` 与导出 `debounce` 同时出现 → 期望 `P07` 一条；只出现 `setTimeout` → 期望零条。
- `pnpm test` 新增用例：项目覆盖 `datetime.syntax` 后，原指纹不再命中、新指纹命中。
- `pnpm guard:self` 与 `pnpm guard:sample` 仍全绿（本体的 `process.argv.slice` 与外层的 dayjs 用法不得因 P07 变红）。

## 边界与取舍

- **已知会漏**：跨行写法（`JSON.parse(\n JSON.stringify(x)\n)`）不命中 —— 指纹是逐行匹配；要修就得把扫描升级成基于事实模型的调用图，成本另算。
- **误报风险**：命名指纹取"导出名与库 API 名重合 ≥2"，阈值可配；单名重合（恰好也叫 `debounce`）不报。
- **被否方案**：把弱指纹直接放进 `syntax`（单证据即报）—— 实测会把正常的 `setTimeout` 防抖 UI 全部报错。

## Comments

- 2026-09-23 初稿。范围收窄到 P07 + 覆盖机制；`--verify-deps` 拆成独立特性。
