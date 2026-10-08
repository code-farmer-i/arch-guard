# 阶段一：三条 0 依赖的"静默失真"修复

Status: done

## 场景（对应 REQUIREMENTS.md 的 R-146 / R-147 / R-148）

三条都不是"缺能力"，而是**已有的东西在真实输入上悄悄给错答案** —— 都来自
[`docs/DEPENDENCY-REVIEW.md`](../../docs/DEPENDENCY-REVIEW.md)（引擎内部实现盘点的阶段一）。
它们的共同点是：**不换库**（0 新依赖、不动 `depsBudget`），修完各自有回归锁住。

- **R-146**：`FORCE_COLOR=0 node es/cli.js` 在**真终端**（stdout 是 TTY）里照样吐 ANSI。
  现在：只在管道里"看起来对" —— 项目自己的测试断言了相反结果，靠"`node --test` 子进程 stdout 是管道"才没红。
- **R-147**：同一份 Node 覆盖率表格，Node 24 能解、**Node 22 解出全错路径**
  （`["#  engine/#   a.mjs", …]`，前缀 `ℹ` vs `#`），且扩展名白名单漏了 `.mts/.cts/.svelte`
  → 文件行被当目录压栈：自己消失 + 污染后续路径。现在：M 域在 Node 22 上按不存在的路径算覆盖率，静默失真。
- **R-148**：`color-mix(in srgb, #0008 50%, #fff)` → `contrastRatio` = **NaN**，
  而 D07 的判据对 NaN 恒为 false → **一条不报**。现在：无障碍规则对 `#RGBA`（CSS Color 4 标准写法）静默放过。

## 目标

- **R-146**：`FORCE_COLOR` 非空即表态（`0` / `false` = 显式关闭）；`TERM=dumb` 无色；`NO_COLOR` 优先级不变。
- **R-147**：报告前缀按 `[ℹ#]` 通吃；文件行判据改成"前三列都是数字"（目录行没有数字）——
  **删掉扩展名白名单**（它本身就是"每加一种源码形态就要改这里、漏一个就静默丢文件"的来源）；
  `all files` 汇总行显式排除。
- **R-148**：hex 解析支持 `#rgb` / `#rgba` / `#rrggbb` / `#rrggbbaa`，alpha 真的参与求值；
  解析不了就返回 `null`（跳过），**绝不产出 NaN**。

## 非目标

- 不换库：`supports-color`（会翻转 `NO_COLOR`/`FORCE_COLOR` 优先级 = 改已文档化语义）、
  `istanbul-lib-coverage`（买的是"支持 coverage-final.json"，属能力替换，见盘点文档 F 项）。
- 不动 `readCoverageReport` 的格式嗅探（"任何 JSON 都当 istanbul 摘要"那条，属盘点文档的 F 项）。
- 不动 WCAG 数学本身（`luminance` / `contrastRatio` 的公式），只修 hex 解析的输入侧。
- 不追求支持 `oklab` / `rgb()` / 命名色（那是"要不要引 culori"的独立决策，见盘点文档 D 项）。

## 验收标准

1. `pnpm check` 全绿。
2. `tests/engine-report.test.mjs`：`FORCE_COLOR=false` → 无色；`TERM=dumb`（含 TTY 为真）→ 无色；
   **TTY 为真 + `FORCE_COLOR=0` → 无色**（这一条是 R-146 的核心：旧实现在这里返回 true）。
3. `tests/metrics.test.mjs`：同一份表格用 Node 22 的 `# ` 前缀与 Node 24 的 `ℹ ` 前缀**都**解出正确路径；
   含 `.mts / .cts / .svelte` 时一个不丢、路径不被污染；`all files` 不出现在结果里。
4. `tests/css.test.mjs`：`resolveColor` 对 `#0008` 给出 `alpha ≈ 0.533`；`#00000080` 给出 `alpha ≈ 0.502`；
   任何输入都**不会**产出含 NaN 的颜色（含 `color-mix` 的两个操作数）。
5. 新夹具 `contrast-alpha`：半透明前景（`#00000060`）压在 `#ffffff` 上对比度不足 → **D07 必报**；
   合规对（不透明深色）不报（`exact: true` 锁住"多报也算错"）。

## 边界与取舍

- **R-147 的判据靠"目录行没有数字"**：这是 Node 22.18.0 与 24.13.0 的实测形状（两版都验过）。
  换成"扩展名白名单"是我们刚修掉的病；若将来 Node 给目录行也印百分比，这条判据要跟着改 ——
  测试里**内嵌了两版的真实输出形状**，改格式会红，而不是静默错。
- **R-148 的 alpha 语义**：`color-mix` 两色混合时若任一操作数带 alpha，按对透明度做纯 srgb 插值是错的
  （要 premultiplied alpha），所以**带 alpha 的两色混合直接跳过**（返回 null），不猜。
  `transparent` 那种单色降透明度的情形可以精确算（`alpha = base.alpha × ratio`），照算。
- **R-146 不缓存 env**：`colorsEnabled()` 每次读环境是刻意的（测试要能在同一进程里改 env 验证），
  64 个调用点的重复读取是微秒级，不值得为它引入缓存与失效语义。

## Comments

- 2026-10-08 立规格。三条都来自引擎实现盘点的阶段一（[`docs/DEPENDENCY-REVIEW.md`](../../docs/DEPENDENCY-REVIEW.md) §4）；
  全部 0 新依赖。R-147 在实现时额外发现第三个子问题（Node 22 的 `# ` 前缀），一并修掉并锁进测试。
