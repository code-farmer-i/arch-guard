# D12–D14 的取值器换成值 AST：干掉 `calc()` 逃生门

Status: done

## 场景（对应 REQUIREMENTS.md 的 R-150）

- **项目声明了数值刻度**（`designSystem({ valueWhitelists: [{ rule:'D12', allow:['4px','8px'] }] })`）时：
  `padding: 13px` 报，而 `padding: calc(100% - 13px)` **一条不报**。
  **现在：不报，也不自述** —— 取值器是 `split(/\s+/)` + 正则，函数里的 `13px` 根本取不到。
- **同一个人在同一个属性上换一种拼写**就绕过整条纪律：`13PX`（CSS 单位大小写不敏感，合法写法）、
  `+13px`、`2.0rem`、`var(--gap, 13px)` 的回退值 —— 全都取不到。
  姊妹规则 D19 反倒**显式跳过** calc（`design-numbers.ts` 的 `DYNAMIC_VALUE`），两条规则态度不一致。

## 背景与问题

`numericTokens` 是 D12–D14（刻度白名单）、D15（内联样式）、D19（重复数值）共用的取值器，9 行：
按空白切词 + 逐词正则。它在两件事上没有"词法"概念：函数（`calc()` 的 `13px` 是独立的词）与单位大小写。
对**门禁**来说"取不到"= "这条纪律在这一点上不存在"，而 `calc()` 恰好是最常用的写法。

## 目标

- 用 `postcss-value-parser` 取值 AST 取数：
  - **函数里也进去**（calc / min / max / clamp / var 回退），带 `url()` 例外（那里是地址不是数值）；
  - **单位大小写不敏感**，数值**归一化**（`+13px` → `13px`、`2.0rem` → `2rem`、`0px` → `0`）；
  - 字符串与 `url()` 不进去。
- 保持"不误报"的既有边界：单位族**要求带单位**（`line-height: 1.5` 的无单位倍数是正常写法），
  无单位族（z-index）只认整数，`cubic-bezier(0.4, 0, 0.2, 1)` 的参数不算时长。

## 非目标

- **不改 D19 对 calc 的显式跳过**：D19 判的是"同一 `(属性, 值)` 跨文件重复"，`calc()` 的值天然带上下文，
  跳过是它的口径；本次只保证 D12–D14 不再有逃生门。
- 不引 `css-tree` / `lightningcss` 之类的完整 CSS 值求值（那是"要不要算 color-mix/oklab"的独立决策）。
- 不做单位换算（`1rem` 与 `16px` 不互相折算）：刻度白名单是**字面量**口径，换算会引入猜测。

## 验收标准

1. `pnpm check` 全绿；`--self-test` 97/97。
2. `tests/design-value-tokens.test.mjs`：
   - `calc(100% - 13px)` / `min(100%, 320px)` / `clamp(1rem, 2vw, 3rem)` / `var(--gap, 13px)` 取到该族的数值；
   - `13PX` → `13px`、`+13px` → `13px`、`2.0rem` → `2rem`、`0.0s` → `0`、`150MS` → `150ms`；
   - 不误吃：`1.5`（无单位倍数）、`cubic-bezier(...)`、`url(13px)`、`"13px"`、`2vw`；
   - `z-index`：`+10` → `10`、`1.5` → 取不到。
3. 夹具 `value-whitelists`：
   - `CalcBad.module.css`（`padding: calc(100% - 13px)`）→ **D12 必报**（旧实现下不报）；
   - `CalcGood.module.css`（`calc(100% - 8px)` / `min(100%, 8px)` / `margin: 0px` / `z-index: +10` /
     `transition-duration: 150MS`）→ **一条都不报**（`exact: true` 锁住"多报也算错"）。

## 边界与取舍

- **归一化是"让白名单按值比"**，不是放宽判据：`+13px` 与 `13px` 是同一个值，配置里写 `13px` 就该同时管住两种拼写。
  归一后的 `0` 由调用方按"零到处都在"放过（`0px` / `0.0s` 从此不再误报）。
- **`var()` 的回退值算数**：它是真的会落到布局上的值。若某项目的回退值本来就该是"另一套刻度"，
  那说明刻度声明不全 —— 报出来是对的（`宁少报` 的例外只对"猜不准"成立，这里猜得准）。
- **被否的方案**：在手搓切词上补一个 `calc()` 分支（函数可以嵌套，`var()` 里还能再套 `var()`，
  等于把值词法重写一遍）；引 `css-tree` 做完整值求值（越出本次的判据边界）。

## Comments

- 2026-10-08 立规格。证据与候选见 [`docs/DEPENDENCY-REVIEW.md`](../../docs/DEPENDENCY-REVIEW.md) 的 E 项。
  实现时发现除 `calc()` 外还有三处同类静默（单位大小写 / `+` 与小数零 / `url()` 被当成数值），一并修掉并锁进测试。
