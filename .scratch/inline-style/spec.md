# 内联样式纪律（D15）

Status: done

## 场景（对应 REQUIREMENTS.md 的 R-83）

- 组件里写 `<div style={{ color: '#ff5a1f', margin: 13, zIndex: 9999, transitionDuration: '200ms' }}>` →
  **同一套令牌层被整个绕过**。现在：**不会报**（实测：D 域零命中）—— D01 只判样式文件、D12–D14 只读 CSS、
  D16 只管"自研样式进不进样式文件"，于是换个写法就绕过整条纪律。
- 换主题时这些值不跟着变（它们不在令牌里），而 review 里一句话看不出来。

## 目标

- `designSystem({ styleDir })` 声明后（**声明才判**，与 D12–D14 同一条能力）：
  - **颜色**：内联 `style` 的颜色属性（`color` / `background*` / `border*` / `boxShadow` / `fill` / `stroke`…）
    里出现颜色字面量（hex / rgb(a) / hsl(a)）→ error；
  - **数值**：属性名归入长度 / 层级 / 时长三族时，按 `valueWhitelists` 判 —— **哪族声明判哪族**，
    不在刻度里的数值报（`'13px'` 与 `13` 都算），`var(--token)` 与白名单里的值不报。

## 验收标准

- 新增事实 `styleProps`（`{ prop, value, numeric, line }`）：只收 **JSX `style` 属性对象字面量**里的属性赋值，
  值必须是字面量（字符串 / 数字）；模板插值等动态值不收。
- 夹具 `inline-style`：颜色字面量与超刻度数值都报；`color: 'var(--brand)'`、白名单里的 `8px`、非 style 的对象属性不报。
- 单测覆盖：camelCase 属性名归一（`fontSize` → `font-size`）、`zIndex`、多值（`margin: '13px 4px'`）、
  非 JSX 对象不判、动态值不判。
- 双 Node `pnpm check` EXIT=0。

## 边界与取舍

- **只判 JSX `style={{}}`**：`<div style={styles.card}>`（走 CSS Module）与主题常量对象（`{ color: '#fff' }`）不判 ——
  后者是"设计系统的家"，不是绕过口。
- **不是 CSS-in-JS 引擎**：`styled.div\`color: #fff\`` / emotion 对象形态不在本期（写不进"同一套刻度"的判断）。
- **颜色只认字面量**：命名色（`'red'`）不算 —— 它本来就该被令牌替代，但把它当"颜色字面量"会误伤 `color: 'inherit'` 一类关键字。
