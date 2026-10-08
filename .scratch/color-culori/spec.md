# 颜色词法与对比度：只认 hex 等于把 `rgb()` 令牌从判定面里删掉

Status: done

## 场景（对应 REQUIREMENTS.md 的 R-153）

- **色板里用 `rgb()` 写令牌**（`--sh-static-brand: rgb(255, 90, 31)`），`contrastPairs` 里也声明了这一对时：
  `resolveColor` 返回 `null` → D07 直接 `continue` → **一对都不算**。
  白字压这个品牌色只有 **3.12:1**（远低于 4.5），**一条不报**。
- **`color-mix` 的两个操作数都带 alpha**（`color-mix(in srgb, #00000080 50%, #ffffff40)`）时：
  旧实现判定"premultiplied 超出表达力" → 返回 `null` → 又是静默少判。
- **D03（色板色值唯一）**的色值身份是 `/#([0-9a-fA-F]{3,8})/` 抠出来的：
  `--a: rgb(255, 90, 31)` 取不到键，于是与 `--b: #ff5a1f`（**同一个色值**）不算重复 → 跨族重复色值漏报。

三处的共同根因：颜色被当成**十六进制字符串**，而不是"一个颜色"。

## 目标

- 颜色求值交给 **culori**：hex（3/4/6/8）· `rgb()` / `rgba()` · `hsl()` / `hsla()` · `hwb()` ·
  `lab()` / `lch()` / `oklab()` / `oklch()` · `color(display-p3 …)` · **具名色** · `transparent`。
- **WCAG 对比度换成 `wcagContrast`**：手搓那份（gamma 展开 + 0.03928 阈值）与它必须**逐位一致**
  —— 门槛就是"换库不许改判据"。
- `color-mix` 按 **CSS 规范的 premultiplied alpha** 算，操作数可以是任意 CSS 颜色。
- **D03 的色值身份 = 解析后的颜色**（`colorKey` 产出 `rrggbb[aa]`），取代"hex 的拼写"。
- 守住 R-148 的底线：**任何路径都不产出 NaN**。

## 非目标

- **不把 D01 的字面量扫描扩成"词扫描 + 颜色校验"**：那样会误匹配选择器里的类名（`.white { … }`），
  具名色字面量暂时不在 D01 的判定面（已在需求的边界里写明）。
- **不改 D07 对"解析不了"的处理**（仍是静默跳过）：本轮保证的是"**能解析的都算**"。
  把 `currentColor` / 悬空 `var()` 变成显式诊断是另一条需求（要新增 notice 或 warn，属契约面）。
- 不做 CSS Color 4 的完整 **gamut mapping**（oklch chroma 收缩）：超色域按渲染器那样**裁剪**，
  并在注释里说明这是近似 —— 返回 `null` 会让声明过的对彻底不判，那更糟。

## 验收标准

1. `pnpm check` 全绿；`--self-test` **98/98**（新夹具 `contrast-syntax`）。
2. `tests/css.test.mjs`：
   - `rgb()` / `hsl()` / 具名色 / `oklch()` / `color(display-p3 1 0 0)`（裁到 `[255,0,0]`）都解析得出；
     `currentColor` / 悬空 `var()` / 裸 hex 词（`abcdef`）仍返回 `null`；
   - `color-mix`：两个带 alpha 的操作数 → `rgb(85,85,85)` alpha `0.37647`（手算吻合）；
     操作数是 `rgb()` / `hsl()` 也算；与 `transparent` 混仍是 alpha 乘权重；
   - **WCAG 对拍**：与测试里内联的"换库前参照实现"在 **729 组网格采样**上差 < 1e-12；
     黑白 21:1、同色 1:1 不变；
   - `colorKey`：`rgb(255, 90, 31)` ≡ `#ff5a1f`；`#00000080` 另有身份；`var()` / `color-mix()` → `null`。
3. `tests/rules-branches.test.mjs`：
   - D03：`rgb()` 与 `#hex` 的同一个色值**必须报**（1 条），`var()` 别名**不许报**；
   - D07：`rgb()` 令牌的一对**必须算出 3.12:1 并报**（旧实现一对都不算）。
4. 新夹具 `contrast-syntax`：D03（色板）与 D07（主题）都必须报；**旧实现下两者都漏报**（夹具因此会挂）。

## 边界与取舍

- **`@types/culori` 是 devDep**：culori 4.x **不带类型声明**（包里没有任何 `.d.ts`），
  这对 TS 项目是硬约束 —— 与 `@types/picomatch` / `@types/postcss-less` 同一处理。
- **裸 hex 词要显式拒绝**：culori 的 `parse('abcdef')` 会当颜色（库的便利），但 CSS 里那是无效声明；
  放进来会把"漏写 `#` 的色值"当真颜色算下去（正确行为是跳过）。守卫只针对**纯十六进制字符的词**
  （具名色里总有 `r` / `s` / `t` / `l` 这类非 hex 字母，撞不上）。
- **浮点**：委托插值后 alpha 不再是"字面量"（`0.2` → `0.19999999999999996`），断言一律按容差；
  D07 的判据本来就带 `1e-9` 余量。
- **被否的方案**：`@csstools/css-color-parser`（同属 postcss 生态、能解 CSS 颜色）——
  它连 `@csstools/css-tokenizer` / `css-parser-algorithms` 一起要 **+3** 依赖；culori 0 依赖、MIT，
  且顺手提供了 WCAG 与 premultiplied 插值两件现成能力。

## Comments

- 2026-10-08 立规格。证据与候选见 [`docs/DEPENDENCY-REVIEW.md`](../../docs/DEPENDENCY-REVIEW.md) 的 D 项。
  实现时把范围从"补 `rgb()/hsl()`"扩到了 WCAG 数学、`color-mix` 的 premultiplied alpha 与 D03 的色值身份 ——
  后两处原本都是**静默少判**，与本次一整轮在修的失败模式同源。
