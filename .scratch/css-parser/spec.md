# CSS 解析交给 postcss：删掉手搓字符扫描器

Status: done

## 场景（对应 REQUIREMENTS.md 的 R-145）

- **项目里有一份"值里带 `;` / `}`"的样式**（`content: ";}"`、`background: url(data:image/svg+xml;base64,…)`、
  或任何 `@media` 里的嵌套）时：手搓扫描器**错位** —— 实测 `.b{content:";}";background:url(data:…;base64,AAA=)}`
  只解析出 `content: "\""`，`background` 整条**消失**。
  **现在：不报，也不自述** —— 该文件的 D03 / D12–D14 / D19 少判，是"静默假绿"。
- **项目用 Sass / Less**（`cssModulesKit` 明确支持 `*.module.scss`）时：这些文件也走同一个扫描器。
  **现在：** 扫描器对 `#{$x}` / `@{x}` 只会静默乱解析（把插值当普通字符），既不报也不说**。
- **样式规模上来**（单文件 >100KB，或全局样式很多）时：扫描器是 **O(文件长度²)**（每条声明都从头算行号）。
  实测：46KB 70ms / 139KB 568ms / 279KB 2217ms（postcss 分别 8 / 22 / 29ms）。
  而 `cssFiles(ctx)` 全仓 **18 处调用**、每次调用重解析全部 CSS —— 代价要乘上去。
  **现在：** 门禁读自己的源码没问题（本仓 0 份 CSS），但宿主一多就体现为"门禁越来越慢"。

## 背景与问题

`src/engine/css.ts` 是一份约 60 行的字符级扫描器（自己数 `{` `}` `;`、自己遮罩注释、自己算行号）。
它当初的定位是"极简、够用、超范围保守跳过"（DESIGN §12 风险表也写着"超范围走 postcss 适配器"）——
但它**不是保守跳过，而是静默错解**：越界之后剩下的声明全部错位或丢失，且没有任何信号。

同时它是**引擎里唯一自研的解析器**：`parseCss` 的语义（块 / 声明 / 自定义属性 / 引用 / 选择器 / 行号）
与成熟 CSS 解析器完全重合，属于典型的"能换成成熟开源库"的候选。

## 目标

- `parseCss` 改由 **postcss** 实现；**导出 API 形状不变**（`CssModel` 的字段一个不少），
  规则层（design-* 各组）一行不改 —— 与 §6.1.1「规则不消费 AST，只消费归一化模型」同一口径。
- 按扩展名选语法：`.css` → postcss 默认；`.scss` → `postcss-scss`；`.less` → `postcss-less`。
  映射放**纯数据表** `src/data/css-syntaxes.ts`，`CSS_EXTENSIONS` 由它派生（消掉第二处真相）。
- 坏语法 **fail-closed**：解析失败抛带 `文件:行:列 + 原因 + 修法` 的错，退出码 2；不再静默错解。
- 顺手修掉两处语义错误（都有回归用例锁住）：
  ① 值里的 `;` / `}` / `url(data:…)` 不再截断；
  ② at-rule 前奏**不再**进 `selectors`（`.a` / `.ant-btn` 这类才是选择器）。
- `var()` 引用**继续用原来的正则**（它已经能处理 `var(--a )` / `var(--a , 8px)` 这类空白写法）：
  最终**没有**引 `postcss-value-parser` —— 实测它把 `url(...)` 当整体、`url(var(--img))` 里那个 `var` 根本走不到，
  比现有正则**更漏**，而正则只是会把字符串里的 `var(--x)` 当引用（现有已知边界）。为一条不成立的收益多一个依赖不值。
- 行号仍为 1-based、指**声明自己那一行**（与旧实现一致，测试锁住）。

## 非目标

- **不动颜色与对比度**（`findColorLiterals` / `normalizeHex` / `resolveColor` / `flatten` / `contrastRatio`）。
  **但这一段另有一个已知正确性 bug，必须在后续单独修（不是"没变更点"）**：`toRgb('#0008')` 会给
  `[0, 8, NaN]`，`color-mix(in srgb, #0008 50%, #ffffff)` 于是算出 `contrastRatio` = **NaN**，
  而 D07 的判据 `ratio + 1e-9 < pair.min` 对 NaN **恒为 false** → 4 位 hex（CSS Color 4 的标准写法）
  会让**无障碍规则静默放过违规**。修法只要 ~4 行（通道非有限就返回 null + hex 白名单从 `{3,6}` 扩到
  `{3,4,6,8}`），但要配 `color-mix(in srgb, #0008 50%, #fff)` 的夹具 —— 那是一条独立需求，不在本规格内。
  换 culori / colorjs.io 的评估见 [`docs/DEPENDENCY-REVIEW.md`](../../docs/DEPENDENCY-REVIEW.md)（解包 1.5MB / 16MB，且两者都不解析 `color-mix()`）。
- **不做 CSS-in-JS**：`style={{}}` 走 D15 的 TS 事实，不在 CSS 解析范围。
- **不改"坏语法如何呈现"的报告通道**：TS 侧有 S00（facts 里的 `parseErrors` → finding），
  CSS 侧目前没有等价物。要让 CSS 坏语法也变成报告里的一条 finding（而不是抛错），
  需要把 CSS 解析上移到 `collect`（顺带把 18 次重复解析收敛成 1 次）——**另开一条需求**，本规格只保证 fail-closed。
- 不引入 `postcss-safe-parser` 之类的容错解析：容错=静默错解，与本规格目标相反。

## 验收标准

1. `pnpm build && node --test tests/*.test.mjs` 全绿；`tests/css.test.mjs` 新增：
   - 值里带 `;` 与 `}`、`url(data:…;…)` 的规则：两条声明都在，值不被截断；
   - `@media` 块内的声明能取到，且 `@media (…)` **不在** `selectors` 里；
   - `var(--a , 8px)` 记为 `hasFallback: true`；
   - `.scss`（含 `//` 注释与 `#{$name}`）与 `.less`（含 `@{name}`）能解析；
   - 坏语法（`.a {` 未闭合）抛错，错误信息含 `文件:行:列`。
2. 既有 4 条用例**一行不改**仍通过（API 形状与行号语义不变的证据）。
3. `pnpm check` 全绿：`--self-test`（夹具回归 exact）、`--self-check-portability`（P1 白名单）、
   `--check-docs`（依赖块与配置同源）、`guard:sample` / `guard:full` / `guard:full-fsd` / `guard:self`。
4. `pnpm guard:self` 能看到运行时依赖预算 = 5 且不报 M07。

## 边界与取舍

- **依赖预算 2 → 5**：`postcss` 是唯一被引入的"真正解析器"（自身带 `nanoid`/`picocolors`/`source-map-js` 三个传递依赖）；
  `postcss-scss` / `postcss-less` 各 0 依赖、合计 ~110KB，换的是"宿主用了 Sass/Less 就不会因为升级本工具而红"。
  **被否的方案**：只加 postcss（Sass 宿主直接硬失败）、只在 `.css` 上用 postcss 而保留旧扫描器（手搓代码只删一半、
  O(n²) 留在预处理文件里）。
- **坏语法抛错而不是 finding**：fail-closed 优先（宁吵不静默）；代价是"编辑到一半的 CSS 会让整轮门禁停下"。
  升级为报告里的 finding 需要先做「CSS 解析上移到 collect」，见非目标。
- **at-rule 前奏不再进 `selectors`**：这是**行为变更**（可能让某些 vendor 选择器模式的命中变少）。
  按"选择器就是选择器"收窄；夹具里没有 at-rule，实测本仓 51 份 CSS 结论不变。
- **`@page` / `@font-face` 这类"直接装声明的 at-rule"** 仍作为一个块进 `rules`（selector 记为 `@name params`），
  否则 `@page { margin: 13px }` 会掉出 D12–D14 / D19 的判定面（比旧实现少判，属于倒退）。
- **`maskCssComments` 仍保留文本级实现**：它是公开导出，被 `findColorLiterals` 用在**非 CSS 文本**上
  （JSX 内联 `style` 的值），不能假设入参是合法 CSS。

## Comments

- 2026-10-08 立规格。实测证据：手搓扫描器在 `content:";}"` 上丢失整条 `background` 声明、
  39 组合成文件上的 O(n²) 曲线、本仓 51 份 CSS 在 postcss 下 0 失败、`.icon-#{$name}` 在默认解析器下抛
  `Unknown word`。依赖口径按"宿主零回归"选 postcss + postcss-scss + postcss-less。
