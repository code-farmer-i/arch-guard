# 裸文案（C8 / C01）

Status: done

## 场景（对应 REQUIREMENTS.md 的 R-32）

- `<button title="保存">保存</button>` —— 写死在 JSX 里的文案**永远翻译不了**，上线才发现界面冒中文。
- **修前：不报**（委派给 `eslint-plugin-i18next` 的 `no-literal-string`：要装插件 + 逐条维护 `ignore` 白名单）。

## 目标

- 声明了 i18n（`copy()` + `i18n(...)`）的项目里，**面向用户的属性**上出现"人话"而它不在 `t(...)` 里 → warn。
- 走过 `t('key')`、URL / 路径、类名、单 token、纯数字 → 放过；测试文件豁免。

## 验收标准

- 夹具 `bare-copy`：`title="保存"` 报；`t('crews.save')`、`alt="crews-logo"`（单 token）、`src="/logo.svg"` 都不报。
- 未声明 i18n 的项目里 C01 进 `skipped`（明列"能力未声明"），不静默通过。
- 双 Node `pnpm check` EXIT=0；DESIGN §5.5 有 C01 行。

## 边界与取舍（**v1 已知缺口**）

- **只判属性，不判 JSX 文本节点**：`facts.strings` 收的是字符串字面量，`<button>保存</button>` 里的文本
  不是字面量节点 —— 要判那半得先让事实模型收 `JSXText`（引擎改动），本版刻意不做，
  记在这里等下一版。**这一半是 C01 场景的主体，补上后价值会明显变大。**
- **只看"人话"**：中文或含空格的多词才算；`crews-logo` / `logo.svg` 这类 token 全放过 —— 宁可漏报。
- **命中给 warn**：文案是"该翻译"的提示，不是红线（品牌名、代码片段本来就不该翻译）。
- **被否方案**：把所有非 `t()` 的字符串都报（误伤爆炸）；用正则识别"中文"就报（URL 里也能有中文路径）。

## Comments

- 2026-09-25 委派评审列入 C8；用户选择全部实现。jsx 文本那一半作为已知缺口记录在此。
