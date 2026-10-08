# 覆盖率产物"读不懂"时的静默放行：0% 与幻影文件

Status: done

## 场景（对应 REQUIREMENTS.md 的 R-152）

- **项目把 `--coverage-report` 指到了 istanbul 的原始产物**（`coverage/coverage-final.json` ——
  这个文件名就写在 `tests/stack.test.mjs` 的用法示例里）时：解析器"是 JSON 就当摘要"，
  于是每个文件的**四个指标全是 0**，M02 / M04 / M05 拿一份**假数据**下结论，报告一个字不说。
- **手滑指到 `package.json`** 时更离谱：它把 `name` / `version` / `private` 当成**三个"文件"**算 0%。
- 指到 `{}` / `[]` / 随便一个文本文件（README、lcov `.info`）→ 静默给出**空文件集**，
  看起来像"这个项目没有文件"，而不像"我读不懂这份产物"。

## 背景与问题

`readCoverageReport` 的嗅探只有一条判据：`trimStart().startsWith('{')` → istanbul 分支。
进去之后 `Object.entries()` 一把梭：没有 `pct` 就 `pct()` 兜 0，没有 `statementMap` 也不管。

这与本仓 M06 的口径**自相矛盾**：M06 的设计是"产物读不到就 fail-closed（error + 修法）"，
而"**读到了但读不懂**"反而拿到了最好的待遇 —— 静默 0%，M 域照常出结论。

## 目标

- **读不懂就报**（错误带修法，由 M06 的既有通道呈现，与"产物不存在"同一条路）：
  - 顶层不是对象（`[]` / 标量）→ 报"不是覆盖率摘要：顶层应是一个对象"；
  - 顶层没有 `total`、或条目没有 `lines/branches/functions/statements` 的 `pct` → 报；
  - 认得出是 istanbul **原始**格式（条目里有 `statementMap` / `fnMap` / `branchMap` / `s` / `f` / `b`）
    → 报错里**直接给修法**："改用摘要报告（vitest `--coverage.reporter=json-summary` / c8 `--reporter=json-summary`）"；
  - 不是 JSON、也没有 Node 覆盖率表格行 → 报"不是覆盖率产物：既不是 JSON 摘要，也不是 Node 覆盖率表格"。
- 合法输入的行为**不变**：istanbul / c8 / vitest 的 `coverage-summary.json` 与 Node 表格照旧解析。

## 非目标

- **不新增"解析 `coverage-final.json` / lcov"的能力**：那是**能力新增**（盘点里对应
  `istanbul-lib-coverage`，+1 依赖），等真有宿主用这两种格式再单独拍板。本次只把"静默假绿"关掉。

## 验收标准

1. `pnpm check` 全绿。
2. `tests/metrics.test.mjs`：
   - `coverage-final.json`（原始格式）→ 抛错，且消息里同时有"原始**格式**"与"`json-summary`"（修法）；
   - `package.json` 形状 / `{}` / `[]` / 纯文本 → 一律抛"不是覆盖率"；
   - 这条错误经 M06 呈现（`覆盖率产物读不到：…`），修法跟着到报告里；
   - 既有：合法摘要的绝对路径仍换算成配置根相对路径；Node 表格（含 `ℹ ` / `# ` 前缀）仍解析。
3. 合法的 `coverage-summary.json` 与 Node 表格**行为零变化**（既有用例继续通过）。

## 边界与取舍

- **收紧的代价是"以前静默通过的坏配置现在红"**：这是**新失败模式**，必须进 CHANGELOG 的升级注意。
  受影响的只有本来就指错文件 / 用了不支持格式的配置 —— 它们此前拿到的是**假数据**。
- **判据故意宽进严出**：`{` 与 `[` 都进 JSON 分支（数组也要拿到"顶层应是对象"这句人话）；
  单个文件的条目只要**有一个**已知指标就算数（不要求四个都齐），避免把小众覆盖率工具误杀。
- 错误由 M06 呈现而不是新开规则：M06 本来就是"产物纪律"的唯一出口，多一条规则会让
  "产物有问题"出现两个出处。

## Comments

- 2026-10-08 立规格。证据与候选见 [`docs/DEPENDENCY-REVIEW.md`](../../docs/DEPENDENCY-REVIEW.md) 的 F 项；
  实现范围从盘点建议的"换 `istanbul-lib-coverage`"改成 **0 依赖的 fail-closed 版**（先关掉假绿，能力后议）。
