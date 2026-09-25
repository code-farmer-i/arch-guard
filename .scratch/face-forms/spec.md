# 方案面形态：规则不再写死 `routes.tsx` / `*.module.css`（T1 第二半）

Status: done

## 背景与问题

T1 第一半把三个方案面（router / data-layer / styles）建成了适配器，但适配器只声明 `packages`，
**规则仍按写死的写法判**：

- `routes.tsx` 写死在 S03 / S04 / S05 / S14 / S15 里，而范式角色表写的是 `modules/{domain}/routes.{ts,tsx}`。
  两边一漂就出假阳性：入口叫 **`routes.ts`** 的域会被报「跨域引用了内部文件」（S04 / S05），
  view 会被报「没有被 routes 引用」（S15③）。
- `*.module.css` 写死在 D16 / D17 里：样式方案换成 Sass（`*.module.scss`）时，
  组件样式文件会被 D16 当成「组件目录里的全局样式」误报。

## 目标

把「规则要判的**形态**」变成方案面的**数据字段**，让规则只读字段，不读写死的文件名：

| 面       | 字段                                 | 消费者                      | 默认                         |
| -------- | ------------------------------------ | --------------------------- | ---------------------------- |
| `router` | `routeFiles: string[]`（入口文件名） | S03 · S04 · S05 · S14 · S15 | `['routes.ts','routes.tsx']` |
| `styles` | `modulePatterns: string[]`（正则）   | D16 · D17                   | `['\\.module\\.css$']`       |

## 已定案的取舍

| 问题                           | 决定                                                                                                                             |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| 默认值住哪                     | `src/data/face-forms.ts`（纯数据，层 1）：规则与 kit 都从这里取 —— 不再有第二处 `routes.tsx`                                     |
| 空清单（`[]`）是什么意思       | **声明"本方案没有这种文件"**（文件路由 / Tailwind）→ 依赖它的规则**不判**；不是"没配"，也不套默认值                              |
| S03 遇到空清单怎么办           | **照报**：S01 已把域根让给 S03，放行等于域根没有规则看着（静默失能）；只改文案，不改判定                                         |
| 自定义正则的 `examples` 从哪来 | `cssModulesKit({ modulePatterns })` **必须**同时给 hit / miss 样例，否则构造期报错 —— 样例拿真正则验证，是唯一能抓住"写歪"的地方 |
| 是否需要改 `requires` 门控     | 不需要：`styles` / `router` 面可以不存在（那时用默认词汇），所以不能用"能力未声明→停用"表达；两种语义不能混                      |

非目标：数据层的形态规则（缓存键唯一出处 / 取数落点）与路由 `paths` 唯一出处**尚未实现** ——
DESIGN §7.2 里原先把它们写成"仍写死形态"，其实是规则本身不存在，本次一并把文档口径改正（缺口照实说）。

## 落点

- `src/data/face-forms.ts`（新）：`DEFAULT_ROUTE_FILES` / `DEFAULT_MODULE_PATTERNS`
- `src/engine/types.ts` + `src/engine/adapters.ts`：`RouterAdapter.routeFiles` / `StylesAdapter.modulePatterns`
  （`modulePatterns` 进 `PATTERN_FIELDS` → 样例必须与真正则一致）
- `src/packs/core/rules/face-forms.ts`（新）：`routeFilesOf` / `routeEntriesOf` / `modulePatternsOf` /
  `isModuleStyle` / `patternRegex`（编译缓存）
- `src/packs/core/rules/structure-routes.ts`（新）：S03 / S14 从 `structure.ts` 搬出来（词汇是它们共用的，
  且 `structure.ts` 已到 500 行上限）
- `src/packs/core/rules/{structure-graph,placement,design-styles}.ts`：S04 / S05 / S15③、提示文案、D16 / D17
- kits：`router-kits/{react-router,none}` 声明 `routeFiles`、`styles-kits/{css-modules,none}` 声明 `modulePatterns`

## 验收

- `pnpm check` EXIT=0（Node 24.13.0）与 Node 22.18.0。
- 夹具 `route-vocabulary`（入口叫 `routes.ts`：只报域根散件）与 `module-pattern`
  （`.module.scss` 认作组件样式、`globals.css` 照报）各 `exact: true`；夹具总数 44 → **48**
  （含收尾的 `route-custom-vocabulary` / `route-custom-vocabulary-gap`）。
- `tests/face-forms.test.mjs`：默认值 / 覆盖 / 空清单 / 样例校验 / S03 空清单照报 / D16·D17 空清单不判 /
  自定义入口名的存在性与聚合判定 / 角色表没跟上时报什么。

## 收尾（第二轮：把"只改 kit 就能自洽"的错误假设改成可判定的报错）

原先的设计假设是"自定义入口名只要改 kit"。**跑夹具时被推翻**：role-less 的文件不进解析
（`collectSources` 只解析命中角色的文件 + 契约域外文件），于是入口自己的 import 在图上不存在 ——
S15③ 会误报"view 没人引用"、S04/S05 看不到入口侧的跨域引用。

改成三条可判定的语义：

1. **位置类判定按词汇**（不看角色 slot）：`S14` 的"有没有入口"、`S15②` 的"入口必被 app 聚合"
   都按 `routeFiles` + `presentFilesOf(ctx)`（扫描域里的真实文件；只看 `ctx.records` 会漏掉 role-less 入口）。
2. **角色表没跟上 → S03 明确报**：名字在词汇里却落在 `scan.missing` 里 →
   `域入口 X 不在目录契约内：角色表里没有它的角色`（一句话说清该改哪，而不是三条规则各报一句误导的错）。
   反向也判：角色表里 `slot: 'routes'` 的文件不在词汇里 → `词汇与角色表不一致`（两处真相同样要收敛）。
3. **入口没进图 → S15③ 不判**（不拿没解析的文件去判"谁引用了 view"）：修好角色表后自动恢复。

夹具两头钉住：`route-custom-vocabulary`（kit + `addRoles`，零发现项）、
`route-custom-vocabulary-gap`（只改 kit：S03 报角色缺口）。演示脚本同步成
`reactRouterKit({ routeFiles })` / `noneRouterKit({ routeFiles: [] })` 的 kit 写法（不再内联裸适配器）。

## 收尾（第三轮：适配器"看不见"这件事）

前两轮做完之后还剩一个可观测性缺口：**适配器只写在配置里，报告完全不提它**。

1. **一个面一个方案 → fail-closed**：`mergePresets` 里同一个面被声明两次且内容不同就报错
   （浅合并静默取后者 = 换库换错没有痕迹）；内容完全相同仍幂等，要覆盖用 `overrides.adapters`。
2. **报告自述 `adapters-in-use`**（`notices` 新 code，**兼容性新增**：不 bump `apiVersion`，
   但要同步冻结测试 + CHANGELOG 单独标注 —— 见 DESIGN §6.9 的两级契约变更）。
3. **`--verify-deps` 列整张适配表**：`facet` / `id` / `specVersion` / 形态字段 / 包对账，
   **没有 npm 包的 kit 也在表里**（CSS Module 这类以前被 `if (names.length === 0) continue` 直接跳过）。

## 收尾（第四轮：`overrides.adapters` 这条未校验通道）

写第三轮那句错误提示（"要覆盖就用 `overrides.adapters`"）时发现的洞：`config.ts` 把
`overrides.adapters` 直接浅合并进去，**不过 `defineAdapter`** ——

- 字段拼错（`routeFile` vs `routeFiles`）= **静默失能**（字段没人读，规则照跑）；
- 面没登记（既没有 kit 随模块加载登记，也没 `defineFacet`）= 引擎完全不认识它：
  `facetOfCapabilityRoot` 找不到 → 能力协商看不见它，`--explain` 也不提；
- `spec.facet` 与它挂在的键不一致同理（能力反查按键找面）。

收法：合并后的适配器**全部**再过一遍 `defineAdapter`（预设里的幂等重跑，覆盖进来的真正校验），
并在 `defineAdapter` 里加"键与 `spec.facet` 必须一致"这一条。自定义面必须先 `defineFacet`
（公共 API）或 import 一份该面的 kit —— 这与"面清单不写死在引擎里"（E2）是同一条纪律。

## Comments

- 2026-09-24 起：`routeFiles` 默认取 `['routes.ts','routes.tsx']`（与角色表 `routes.{ts,tsx}` 对齐）——
  原来规则里的 `routes.tsx` 与角色表不一致本身就是 bug，不是"仅词汇抽象"。
- 2026-09-24 `pnpm check` EXIT=0（Node 24.13.0）；`--self-test` 46/46；`--self-check-portability` 83 个文件；
  `--check-docs` 通过；狗粮与 `examples/minimal` 照常通过。
- 2026-09-24 收尾后：`--self-test` 48/48；`tests/face-forms.test.mjs` 8 例；双 Node `pnpm check` EXIT=0
  （Node 22 用 `nvm exec 22.18.0 … pnpm check` —— 直接 `node22 pnpm.cjs check` 的子进程仍是 Node 24，我踩过）。
