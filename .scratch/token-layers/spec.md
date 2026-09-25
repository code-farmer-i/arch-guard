# 令牌分层：色板只放静态值 · 组件样式只消费语义令牌（M4 / D02 + D18）

Status: done

## 场景（对应 REQUIREMENTS.md 的 R-80）

- 色板里混进语义名（`--sh-brand: #ff5a1f`）—— 它被当成"语义令牌"用，却**不会随主题变**（明暗切换那处不动，排查半天）。
- 组件样式直接引底层静态值（`color: var(--sh-static-gray-3)`）—— 换主题 / 换品牌色时那一处不跟着变。
- **修前：两条都没实现**（DESIGN 里早有设计，`coreRules` 里查不到 D02/D18）。

## 目标

- `designSystem({ staticPrefix: '--sh-static-' })` 声明后：
  - **D02**：色板文件里定义的自定义属性必须带该前缀（语义令牌放主题文件）；
  - **D18**：组件样式文件里引用该前缀的令牌即报（该走语义令牌）。
- **不声明 `staticPrefix` 就不判**（前缀是项目的事实；`--sh-` 是某个宿主的前缀，不该做通用默认）。

## 验收标准

- 夹具 `token-layers`：`palette.css` 里的 `--sh-brand` 报（D02）；`CrewsPage.module.css` 里
  `var(--sh-static-gray-3)` 报（D18）；色板里的 `--sh-static-gray-3`、组件里的 `var(--sh-brand)`、
  主题文件不报。
- 双 Node `pnpm check` EXIT=0；DESIGN §5.3 的 D02/D18 行标"已实现"。

## 边界与取舍

- **只判"名字/引用"，不判"值对不对"**：色板里 `--sh-static-x: var(--sh-static-y)`（别名）合规。
- **D18 只看组件样式文件**（形态由 `styles.modulePatterns` 声明）：全局样式与 vendor 覆盖不在其列；
  方案没有组件样式文件（Tailwind）→ 不判。
- **不做"语义令牌必须明暗两套都定义"**：那是 D06 的活（已实现），两条不重复。
- **被否方案**：内置 `--sh-static-` 默认前缀 —— 那是某个宿主的事实，会误报所有别的前缀约定。

## Comments

- 2026-09-25 挖掘需求时选中（DESIGN §14 里"D02 / D18 尚未实现"那两行）。
