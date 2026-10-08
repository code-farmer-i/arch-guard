# 引擎内部实现盘点：手搓 → 成熟开源库

> **这份文档回答一个问题**：`src/engine/**` 里那些**自己写的解析器 / 匹配器 / 扫描器 / 计算**，
> 哪些该换成成熟开源库（或至少换成成熟实现）来降低维护成本？
>
> 它与另外两份的分工：
> [`ECOSYSTEM-AUDIT.md`](./ECOSYSTEM-AUDIT.md) 看的是「**规则**能不能委派给 eslint / stylelint / knip」，
> [`ALTERNATIVES.md`](./ALTERNATIVES.md) 看的是「整套替代品有没有」；**这份看的是引擎自己的实现层** ——
> 判据留在本体，但**怎么解析、怎么匹配**不该是自研的。
>
> 状态：**部分落地**（2026-10-08 盘点）。已落地：§3 的 CSS 解析（R-145）与 §4 阶段一的三条 0 依赖修复
> （R-146 / R-147 / R-148）与阶段二的 A（R-149，glob → picomatch）、E（R-150，取值器）与 B（R-151，walk 环检测）；**F 与 D 后半仍待拍板**。每条落地时都要先回填 [`REQUIREMENTS.md`](../REQUIREMENTS.md) 与
> `.scratch/<slug>/spec.md` —— 本文只是证据与选项，不是承诺。
> 测量环境：Node v24.13.0；Node 内置能力与 Node 22 特有行为另在 **v22.18.0（`engines` 下限）** 复验。

## 0. 结论速览

| #   | 候选                                                           | 结论                                           | 依赖代价        |
| --- | -------------------------------------------------------------- | ---------------------------------------------- | --------------- |
| A   | `globToRegExp` → picomatch                                     | ✅ **已落地**（R-149）                         | +1              |
| B   | `walk` 的符号链接策略                                          | ✅ **已落地**（R-151：保留跟随，只切环）       | 0               |
| C   | ANSI 颜色策略 `colorsEnabled`                                  | ✅ **已落地**（R-146，就地修）                 | 0               |
| D   | 色彩与对比度数学                                               | ✅ **NaN 已修**（R-148）；要 oklab 再上 culori | 0 或 +1         |
| E   | `numericTokens`                                                | **换**（待拍板）                               | +1（复用则 +0） |
| F   | `coverage.ts` istanbul 分支                                    | **换（低优先级）**                             | +1              |
| G   | `coverage.ts` Node 表格分支                                    | ✅ **已落地**（R-147，另修 Node 22 前缀）      | 0               |
| —   | `git.ts` / `stableKey` / `graph.ts` / `config.ts` / CLI / 排版 | **不换**（见 §2）                              | 0               |
| —   | **CSS 解析（已落地）**                                         | **换 postcss 家族**（R-145，见 §3）            | +3              |

**三个会改变判断的实测结论**：

1. Node 22.5+ 内置的 `path.matchesGlob` 看着能 0 依赖替掉 `globToRegExp`，**实测慢 143×**（1793ms vs 12.5ms）——
   "0 依赖"在这里是陷阱。
2. `resolveColor` 有一个**与色彩空间无关的 NaN bug**，会让 D07（对比度）**静默放过违规**（见 D）——
   不是"要不要支持 oklch"那种取舍。
3. 7 个候选里 **3 个的最优解是 0 新依赖的就地修复**，不是换库。

---

## 1. 候选与证据

### A. `globToRegExp` → `picomatch`（**换**）

- **位置**：`src/engine/util.ts:79-119`（41 LOC）；**23 个调用点 / 16 个文件**（`scan.ts` 的角色编译、
  `structure-declared`、`design-sources`、`structure-call-sites`、`metrics-test-homes`、`advice`…）。
- **手搓的真实风险**（都是实测）：
  1. **不支持 `[...]` 字符类**：`globToRegExp('src/**/[a-z]*.ts')` 的 source 是 `^src\/(?:.*\/)?\[a-z\]…` → 永不匹配；
     extglob `!(...)`、`{1..3}` 数字区间同样不支持。
  2. **端到端"静默丢文件"**：同一宿主 `include: ['src/app/**', 'src/shared/**']` → 3 个 error
     （含 `[S05] src/shared/lib/format.ts` 与 `[S08] 依赖环`）；换成同义的
     `include: ['src/app/**', 'src/shared/**/[a-z]*.ts']` → **只剩 1 个 error**：2 个文件被移出契约域
     （报告从"域外 1 个"变"域外 2 个不判契约"），S05 与 S08 一起消失。
     S24 只在**整个**扫描域为空时报，**部分欠匹配零诊断** —— 这正是门禁最怕的假绿。
- **候选**：`picomatch@4.0.7`（6.25 亿/周 · **0 依赖** · CJS · MIT）。
  **注意**：具名导入在 ESM 下直接 `SyntaxError`（实测），只能 default import。
  **切勿**用 `path.matchesGlob`（见 §0 结论 1）。
- **代价**：`RegExp.test(p)` → `matcher(p)`；**必须传 `{ dot: true }`**（手搓版 `**/*.ts` 匹配 `.agents/x.ts`）。
  差分实测：18 个真实 glob × 20 条路径，**只有 1 处无害差异**（`src/**` 也匹配裸路径 `"src"`）。
  性能 17.8ms vs 18.4ms（**0.97×**，无悬崖）。`scan.ts` 的 `{name}` 占位编译那处保留。
- **门禁代价**：`allow` 加 `picomatch`；`depsBudget.runtime` +1。

### B. `walk` / `classifyEntry`（**再评估，先开 spec**）

- **位置**：`src/engine/util.ts:33-41` + `44-69`（35 LOC）；3 个调用点（`scan.ts:197`、`docs.ts:352`、`portability.ts:96`）。
- **真实风险**：**无环检测、无根包含**。`ln -s .. src/back` 实测：手搓 `walk` 返回 **32 个幻影文件**
  （`src/back/src/back/…` 一路膨胀到 `ENAMETOOLONG` 才被 catch 终止）；该宿主跑 CLI → **66 个 error**，报告不可用。
  链接还能把**项目根之外**的文件拉进扫描。
- **候选**：Node 内置 `fs.globSync`（22.14+，**在 22.18.0 上实测可用**）——**0 依赖、0 预算、环安全**；
  备选 `fdir@6.5.0`（2.44 亿/周 · 0 依赖 · 真 ESM · MIT）。
- **为什么是"决策"而不是"换库"**：手搓版**跟随**目录符号链接是
  `util.ts:22-28` 明文声明的行为，`tests/cli-extra.test.mjs:160` 依赖它。不再跟随 = **行为契约变更**
  （要 CHANGELOG 破坏性段落 + 改那个宿主）。建议**单独立项**，别夹带。

### C. ANSI 颜色策略（**就地修 ~6 行，不换库**）

- **位置**：`src/engine/util.ts:222-248`（27 LOC）；**64 个调用点**。
- **真实风险（已生效的契约违背）**：`FORCE_COLOR=0` 在真 TTY 下**仍然上色** ——
  `if (FORCE_COLOR !== '' && FORCE_COLOR !== '0') return true` 之后落到 `return process.stdout.isTTY === true`。
  把 `process.stdout.isTTY` 强制成 true（pty 唯一会改的观测量）实测：`colorsEnabled() === true`、
  `color.red('x') === '\u001b[31mx\u001b[0m'`。
  **项目自己的测试写死了相反期望**（`tests/engine-report.test.mjs:397`），今天只靠"`node --test` 子进程 stdout 是管道"才通过；
  直接 `node tests/engine-report.test.mjs` 就会红。其余不认的还有 `TERM=dumb`、`CI`、`FORCE_COLOR` 的色深层级。
- **候选**：参考 `supports-color@11.0.0`（6.11 亿/周 · 0 依赖 · 真 ESM · MIT）。
  **别用 `picocolors`**：源码谓词 `… || !!env.CI` 会在 **CI 里强制上色**（与本项目目标相反），
  且 `!!env.FORCE_COLOR` 对字符串 `"0"` 为真 —— `FORCE_COLOR=0` 一样错。
- **为什么不换库**：就地修只要 ~6 行，而换库会改两处**已文档化**的语义
  （`NO_COLOR=1 FORCE_COLOR=1` 现在 NO_COLOR 赢，supports-color 是 FORCE_COLOR 赢），
  还要同步 `cli.ts:161`、`docs/USAGE.md`、测试。**修复比集成小**。

### D. 色彩与对比度数学（**先修 NaN；culori 只在要 oklab 时上**）

- **位置**：`src/engine/css.ts:157-242`：`toRgb` / `luminance` / `resolveColor` / `flatten` / `contrastRatio` /
  `findColorLiterals` / `normalizeHex` ≈ 93 LOC；8 个调用点（D07 在 `design-vendor.ts:51-60`、D03/D05 在 `design-tokens`）。
- **真实风险（必修）**：`toRgb('#0008')` → `[0, 8, NaN]`（`parseInt('', 16)` = NaN）；
  `color-mix(in srgb, #0008 50%, #ffffff)` → `{ rgb: [128, 132, NaN], alpha: 1 }` → `contrastRatio` = **NaN**，
  而 `design-vendor.ts:61` 的判据 `ratio + 1e-9 < pair.min` 对 NaN **恒为 false** → **D07 一条不报**。
  4 位 hex 是 CSS Color 4 的标准写法。其余静默跳过（返回 null = 整对不判）：`#00000080`（Tailwind `/50` 惯用）、
  `color-mix(in oklab, …)`（只支持 `in srgb`，而 oklab 才是浏览器默认插值空间）、`rgb()/hsl()/named`。
- **修法（0 依赖，~4 行）**：`toRgb` 的通道非有限就返回 null（让规则"跳过"而不是"NaN 通过"）+
  hex 白名单从 `{3,6}` 扩到 `{3,4,6,8}` + 一个 `color-mix(in srgb, #0008 50%, #fff)` 夹具。
- **换库（可选）**：`culori@4.0.2`（359 万/周 · 0 依赖 · 真 ESM · MIT，`parse()` + `wcagContrast()`）
  或 `colorjs.io@0.7.1`（1098 万/周 · 0 依赖 · MIT）。**两者都不解析 `color-mix()`**，
  令牌链与 `color-mix` 求值仍得自己写。解包体积 culori 1.5MB / colorjs.io **16MB**。

### E. `numericTokens`（**换，并进 postcss PR 则边际≈0**）

- **位置**：`src/packs/core/rules/design-shared.ts:153-161`（9 LOC）；3 个调用点（D12–D14、D15、D19）。
- **真实风险**：**`calc()` 是 D12–D14 的静默逃生门** —— `numericTokens('calc(100% - 13px)', ['px','rem','em'])` → `[]`，
  于是 `padding: calc(100% - 13px)` 在刻度白名单下**一条不报**，而 `padding: 13px` 会报。
  姊妹规则 D19 在 `design-numbers.ts:36` **显式跳过** calc（有意），D12–D14 没有这个判断却同样算不出 token ——
  两条规则态度不一致，说明至少一条不是故意的。其余静默漏：`'13PX'`（**CSS 单位大小写不敏感**）、`'+13px'`、
  `'13 px'`、`'13px/4px'`（font 简写）。units 还是**未转义**拼进 RegExp 的。
- **候选**：`postcss-value-parser@4.2.0`（1.18 亿/周 · **0 依赖** · MIT）—— 给 `function` 节点（calc/clamp 可递归）与 `div` 节点（`/`、`,`）。
- **注意**：CSS 解析那次**没有**引它（`url(var(--img))` 它走不到，见 §3）；这里是**另一个**消费者，
  若单独引就是 +1 依赖，若与 A 一起做则仍要各自登记。

### F. `coverage.ts` istanbul 分支（**换，低优先级**）

- **位置**：`src/engine/coverage.ts:40-66`（24 LOC）。
- **真实风险**：**任何 JSON 都被当成 istanbul 摘要**（嗅探就是 `text.trimStart().startsWith('{')`）。
  最现实的输入是 `--coverage-report coverage/coverage-final.json`（istanbul 的**原始**格式，
  字面出现在 `tests/stack.test.mjs:71`）：实测 → `format: 'istanbul-json'`、**四个指标全 0**、**不报错**。
  指到 `package.json` / `tsconfig.json` 同样静默出 `files: []`。与 M06「产物读不到就 fail-closed」的哲学不一致：
  读到了、但读不懂，却当成真的 0%。
- **候选**：`istanbul-lib-coverage@3.2.2`（9925 万/周 · **0 依赖** · CJS · **BSD-3-Clause**）——
  实测能从 `coverage-final.json` 正确算出汇总。要 lcov 再加 `istanbul-lib-report`。

### G. `coverage.ts` Node 表格分支（**就地修 ~3 行；没有成熟库**）

- **位置**：`src/engine/coverage.ts:69-103`（35 LOC）。
- **真实风险**：**扩展名白名单缺 `.mts`/`.cts`/`.svelte`，且会连带改名后续行**。
  仓库自己的 `src/data/framework-sources.ts:27` 就声明支持 `.mts`/`.cts`。
  实测输入 `src / a.mts / b.cts / c.tsx / d.vue / e.svelte` → 只解出 **`src/b.cts/c.tsx`、`src/b.cts/d.vue`**：
  `a.mts`、`e.svelte` 消失，`b.cts` 被当成**目录前缀**污染后两行（非文件行被压进缩进栈）。
  真实 Node 24.13.0 的输出本身能正确解析 → 漏洞在白名单，不在算法。
- **候选**：**没有成熟库解析 Node 的覆盖率文本表**（istanbul/c8/vitest 生态都不吃）。
  成熟路线是改吃机器可读格式：`NODE_V8_COVERAGE` + `v8-to-istanbul@9.3.0`（5479 万/周 · **3 依赖** · ISC）
  - `istanbul-lib-coverage`。那是**能力替换**（要改 USAGE + 夹具），不是"修 bug"。

---

## 2. 不建议换（附理由）

| 候选                          | 为什么不换                                                                                                                                                                                                                                |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `git.ts`（199 LOC）           | 它**已经在用最成熟的实现 —— git 自己**。`git.ts:87-101` 明文拒绝了手解 `.gitignore`（否定 `!`、锚定 `/build`、子目录 `.gitignore`、`info/exclude`、全局 excludes）。换 `simple-git`/`isomorphic-git` 只是用依赖换掉一层薄封装             |
| `stableKey`（10 LOC）         | 碰撞确实存在（`{x:NaN}`≡`{x:null}`、`new Date(0)`≡`new Date(1)`、`Set/Map`≡`{}`），但**不可达**：只服务"同一适配器面声明两次"的判定，而适配器经 `defineAdapter` 字段白名单校验（`adapters.ts:198-230`）                                   |
| `graph.ts` 模块解析（51 LOC） | 缺口是真的（不认 `exports`/`imports`、不认 tsconfig `paths`），但**没有实测到一条具体漏判**；决定性理由是它在**内存 `fileSet` 上解析、零 FS I/O**，而没有纯 JS 的内存版等价库（`oxc-resolver` 是 native，已被 `.scratch/oxc-spike` 否决） |
| `config.ts` 配置加载          | 用的就是平台能力（原生 ESM 动态 import + 有意的 cache-busting）。`jiti`/`lilconfig` 买到的是 **TS / JSON 配置支持**，那是新能力不是换实现，还要背转译层                                                                                   |
| CLI 参数与输出                | 参数解析已是 `commander`（能力表登记的 `cli-args`）。剩下手搓的是**故意的**：fail-closed 取值校验、`invokedAsScript()` 的 realpath 比较（注释记录了 macOS `/tmp→/private/tmp` 会让 CLI 静默退出 0）                                       |
| 报告 / 说明的文本排版         | 全仓只有 2 处 `padEnd`，补的全是 **ASCII** 的 id（中文标签不参与补齐）→ `string-width`/`ansi-regex` 没有消费者；`docs.ts` 扫的是 HTML 注释哨兵，上 markdown AST 只会更重                                                                  |
| TS 解析（`oxc-parser` 等）    | 已在 `.scratch/oxc-spike/spec.md` 量过并否决：解析只占 `extractFacts` 的 32%，收益上界 ≈17%，还要重写事实提取层 + 分发 native 二进制                                                                                                      |

---

## 3. 已落地：CSS 解析 → postcss（R-145）

见 [`docs/DESIGN.md` §6.1.2](./DESIGN.md) 与 `.scratch/css-parser/spec.md`。摘要：

- **旧实现是静默错解，不是"保守跳过"**：`.b{content:";}";background:url(data:…;base64,AAA=)}` 只解析出
  `content: "\""`，`background` 整条**消失**；at-rule 前奏被当选择器；行号从头算 = **O(n²)**
  （46KB 70ms / 139KB 568ms / 279KB **2217ms**，postcss 8 / 22 / 29ms）。
- **落地**：`postcss` + `postcss-scss` + `postcss-less`（后两个是 Sass/Less 专有语法的托底，
  否则 `.icon-#{$name}{}` 这类会让宿主直接红）；映射在纯数据表 `src/data/css-syntaxes.ts`。
- **没引 `postcss-value-parser`**：实测它把 `url(...)` 当一个整体、`url(var(--img))` 里的 `var` 走不到，
  比现有正则更漏（见 E 的备注）。
- **运行时依赖 2 → 5**；`apiVersion` / `NOTICE_CODES` / 退出码语义均未变。

---

## 4. 建议的执行顺序（拍板用）

**阶段一 · 0 依赖、只修 bug** —— ✅ **已落地**（R-146 / R-147 / R-148，见 [`CHANGELOG.md`](../CHANGELOG.md) `[Unreleased]`）

1. ~~**C** —— `colorsEnabled` 的 `FORCE_COLOR=0` + `TERM=dumb`~~ → **R-146**。
   实现时补上同族的 `FORCE_COLOR=false`（同一个坑的另一种写法）。
2. ~~**G** —— coverage 扩展名白名单 + "文件行"判据~~ → **R-147**。
   实现时发现**第三个**子问题：报告前缀随 Node 版本变（22 是 `# `、24 是 `ℹ `），旧实现只剥 `ℹ` ——
   在 `engines` 下限 22.18.0 上解出的路径**全是错的**。一并修掉并锁进测试。
3. ~~**D 前半** —— 色彩通道 NaN 就不判 + hex 白名单扩到 `{3,4,6,8}`~~ → **R-148**。
   实现成完整的 `#rgb` / `#rgba` / `#rrggbb` / `#rrggbbaa` 解析（alpha 真的参与求值），
   而不是"放宽白名单"—— 放宽而不解析 alpha 等于把错值算得更自信。新夹具 `contrast-alpha`。

**阶段二 · 换库（+1 依赖，收益明确）**

4. ~~**A** —— `globToRegExp → picomatch`~~ → **R-149**（✅ 已落地）。
   实现时发现盘点没覆盖的一处：picomatch 的 `a/**` **也匹配 `a` 本身**，在 `fsd()` 的
   `{slice}/{segment}/**` 上会把文件名吃进捕获段 → 与切片入口角色撞车 → S01 歧义（实测）。
   收口方式：尾随 `/**` 再补一层 `/*`（连同 `dot:true` / `nonegate:true`）—— **与旧实现零行为变更**，
   本次真正新增的只有「字符类与 extglob 真的能用」。
5. ~~**E** —— `numericTokens → postcss-value-parser`~~ → **R-150**（✅ 已落地）。
   实现时把范围从"堵住 calc"扩到了完整词法：单位大小写、`+`/小数零归一化、`url(...)` 与字符串不进、
   `z-index` 仍只认整数 —— 全部有单元测试 + "必报 / 不报"两半夹具。

**阶段三 · 需决策或收益较小**

6. **F** —— `coverage` istanbul 分支 → `istanbul-lib-coverage`（顺带让"指错文件"报错）。
7. ~~**B** —— `walk` 的符号链接策略~~ → **R-151**（✅ 已落地）。决策：**保留跟随**（workspace 链接源码目录，
   不跟随 = 少判 = 静默假绿），只按"真实路径链"切环 —— 因此**不需要** `fs.globSync` / `fdir`，预算不动。
8. **D 后半** —— 色彩换 `culori`：只在要 `rgb()/hsl()/oklab` 或想删掉 WCAG 数学时才做。

**预算账**：`depsBudget.runtime` 现在是 **7**（commander / picomatch / pluralize / postcss / postcss-less /
postcss-scss / postcss-value-parser）。阶段一三条**不动预算**；阶段二两条各 +1。
`capabilities` 这轮都不用动 —— 现有能力是 `datetime / cli-args / deep-clone / unique-id / number-format /
deep-equal / query-string / debounce-throttle / validation`，P06 不会因为不登记而报错；但 **P01 会**
（开关是 `allow`），所以新增运行时依赖必须同步 `allow`。

---

## 5. 复现方式

```bash
# A：glob 差分 + 端到端假绿（脚本在 /tmp，本轮盘点用）
node /tmp/ag-diff-glob.mjs      # 手搓 vs picomatch(dot:true)：18 glob × 20 路径仅 1 处无害差异
node /tmp/ag-bench-pico.mjs     # 17.8ms vs 18.4ms（0.97×）
node /tmp/ag-bench-glob.mjs     # path.matchesGlob 慢 143×
# B：符号链接环 / 越界
node /tmp/ag-walk-probe.mjs     # 手搓 walk → 32 个幻影文件；fs.globSync → 1 个
# C/D/E/F/G：直接调 es/ 里的函数（输入见上文每条）
node --input-type=module -e "import {resolveColor,contrastRatio} from './es/engine/css.js'; …"
```

**唯一未完成的验证**：本会话沙箱不允许开 pty（`openpty: Operation not permitted`），
候选 C 的 TTY 行为是用"强制 `process.stdout.isTTY = true`"（pty 唯一会改变的观测量）复现的；
代码路径本身无歧义（`util.ts:230-236`）。
