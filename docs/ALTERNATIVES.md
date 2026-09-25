# 替代组合与竞品盘点

> **这份文档回答两个问题**：① 不装本门禁，用市面上的成熟工具能覆盖我们多少？② 那些工具的边界在哪、我们立得住的是什么？
>
> 它是 [ECOSYSTEM-AUDIT.md](./ECOSYSTEM-AUDIT.md) 的**整体版**：那份审计逐条回答「这条规则生态里谁在做」，
> 这份回答「整包替代品有没有、拼出来能到几成」。
>
> 数据来源：npm registry（版本 / 发布时间 / 周下载量）、各包 README 与规则文档、以及**本地实测**
> （安装后真跑一遍）。每条都标了依据，可复查。

## 0. 结论速览

| 问题                     | 结论                                                                                      |
| ------------------------ | ----------------------------------------------------------------------------------------- |
| 有没有单一替代品         | **没有**。最接近的 `steiger` 只做 FSD 目录规范；`dependency-cruiser` 只做依赖图           |
| 拼一套成熟组合能覆盖多少 | 约 **30 / 53 条**（结构 + 单文件形态 + 部分文案/依赖/度量）                               |
| 拼不出来的               | **跨文件令牌图、跨语言一致性、声明⇄事实、依赖选型体系、零容忍判定、判定纪律**             |
| FSD 项目怎么办           | 结构交 `steiger`；契约层可以接我们（`library({ modules: 六层, entry: [] })`），实测零重叠 |
| 我们的定位启示           | **目录规范是团队选择，契约层才是跨方法论通用的** —— 见 §8                                 |

---

## 1. 逐条对照：我们的能力生态里谁在做

> 逐条判据的**归类与理由**（生态无法表达 / 要重抄项目数据 / 部分重叠）见 [`ECOSYSTEM-AUDIT.md`](./ECOSYSTEM-AUDIT.md) §2；本表只回答「生态里谁在做、规模多大」。

周下载量为 2026-09 的 last-week 数据（npm registry）。

| 我们的判据                   | 最近的竞品                                                                             | 周下载             | 等价程度                                                                                               |
| ---------------------------- | -------------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------ |
| D12–D14 / D18 值必须来自令牌 | `stylelint-declaration-strict-value`                                                   | 383,488            | ✅ 等价（**已委派**）                                                                                  |
| D04 令牌引用闭合             | `stylelint-value-no-unknown-custom-properties`                                         | 156,630            | ⚠️ **只查文件内**；我们是跨文件令牌图                                                                  |
| D05 死令牌                   | `find-unused-sass-variables`（Sass）；`postcss-discard-unused`（只丢 keyframes/fonts） | 37,997 / 1,891,840 | ❌ CSS 自定义属性的"未使用"没有成熟工具                                                                |
| D03 色值唯一                 | stylelint `color-no-hex` + overrides                                                   | —（内置）          | ⚠️ 只查"哪里能写"；"同一色值只写一次"跨文件查不了                                                      |
| D07 对比度                   | axe-core / pa11y                                                                       | 主流               | ⚠️ 它们查**运行时渲染**，我们查**令牌对的基线**                                                        |
| C01 裸文案                   | `eslint-plugin-i18next`                                                                | 1,013,374          | ✅ 等价（**已委派**）                                                                                  |
| C03 多语言同构               | `eslint-plugin-i18n-json` 的 `identical-keys`                                          | 96,750             | ✅ 等价，但只对 **JSON**；我们是两份 TS 嵌套对象                                                       |
| C02 / C06 键存在 / 死键      | `i18n-unused`                                                                          | 65,192             | ✅ 基本等价                                                                                            |
| 未使用的依赖 / 导出 / 文件   | `knip`                                                                                 | 10,457,730         | ⚠️ 模块级，不是字面量级唯一出处                                                                        |
| 模块级"只许某处 import"      | `dependency-cruiser`                                                                   | 2,874,211          | ⚠️ 模块级唯一出处（要手写规则）                                                                        |
| 边界（element 语义版）       | `eslint-plugin-boundaries`                                                             | 1,099,071          | ⚠️ 同上，要重写一份 element 表                                                                         |
| 目录契约 / 命名 / 配对       | `eslint-plugin-project-structure`（`folder-structure` / `file-composition`）           | —                  | ⚠️ 要写一份"自己造框架"的配置                                                                          |
| 组件级设计系统约束           | `@shadcn/lint`（0.2.0，2026-09-22，agent-first）                                       | 380,443            | ⚠️ 绑 **Tailwind 类名**（`no-raw-colors` / `no-arbitrary-values` / `no-inline-styles` / `no-restyle`） |
| 令牌强制（Biome 版）         | `@moderneinc/biome-plugins`                                                            | 1,589              | ⚠️ 新兴、量级小                                                                                        |
| 覆盖率棘轮                   | `jest-coverage-ratchet` / Codecov / `diff-cover`                                       | —                  | ⚠️ 只管覆盖率一个域                                                                                    |

**设计令牌这块最近冒出一批新玩家**，`@shadcn/lint` 尤其值得盯：**agent-first、38 万/周、React/Svelte/Vue 全支持** —— 攻击的正是 D 域的产品化叙事（只是绑 Tailwind）。

## 2. 一套"最大覆盖"的成熟组合

| 层              | 工具                                                                                                                                           | 覆盖什么                                                              |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| **结构 / 边界** | `dependency-cruiser` + `eslint-plugin-boundaries` + `eslint-plugin-project-structure`                                                          | 域隔离、层序、环、孤儿、公开面、目录契约、命名                        |
|                 | eslint 内置                                                                                                                                    | `no-restricted-imports`（越级）、`no-restricted-exports`、`max-lines` |
| **设计系统**    | `stylelint` + `declaration-strict-value` + `value-no-unknown-custom-properties`；Tailwind 项目加 `@shadcn/lint`；令牌生成用 `style-dictionary` | 令牌值强制、跨文件外的悬空引用、`!important`                          |
| **文案**        | `eslint-plugin-i18next` + `i18n-unused` +（JSON 形态）`eslint-plugin-i18n-json`                                                                | 裸文案、缺键、死键、多语言同构                                        |
| **依赖**        | `knip` + `eslint-plugin-import`                                                                                                                | 幽灵依赖、未使用依赖/导出/文件、禁用库                                |
| **反退化**      | `@typescript-eslint/*`、`no-console`·`no-debugger`·`no-empty`·`no-warning-comments`、`no-restricted-syntax`、`eslint-plugin-sonarjs`           | **H 域基本全覆盖**                                                    |
| **度量**        | `vitest`/`c8` `thresholds`（含 glob + perFile）、`diff-cover`、Codecov                                                                         | 覆盖率阈值、变更覆盖率                                                |
| **去重**        | `jscpd`                                                                                                                                        | 复制粘贴（S17 的文本近似）                                            |
| **存量豁免**    | **eslint 内置 `--suppress-all` / `--prune-suppressions`** + **stylelint 内置 `--suppress`**                                                    | 存量治理（**我们不提供**：零容忍）                                    |

```jsonc
// package.json
"scripts": {
  "check": "eslint . && stylelint \"**/*.css\" && depcruise src && knip && vitest run --coverage"
}
```

```js
// .dependency-cruiser.cjs —— 角色表在这里抄第一份
forbidden: [
  {
    name: 'no-cross-domain',
    severity: 'error',
    from: { path: '^src/modules/([^/]+)/' },
    to: { path: '^src/modules/(?!$1)' },
  },
]
```

### 覆盖率的账

| 域       | 组合覆盖     | 空缺                                                                                         |
| -------- | ------------ | -------------------------------------------------------------------------------------------- |
| S（37）  | ≈12          | **S11 禁 barrel**（生态无等价）、S18、S19、S20、**S34 度数 · S35 空壳组 · S36–S38 调用落点** |
| D（14）  | ≈5           | D03、**D05**、D06、D08、D16、**D17**、D21、D22、D23                                          |
| C（6）   | ≈4           | C04、C05、C07                                                                                |
| P（8）   | ≈2           | **P01/P04/P05/P06/P07/P11/P12 全空**                                                         |
| M（8）   | ≈4           | M06、M07、M08、M09                                                                           |
| H（2）   | 全覆盖       | —（H12 退路不留属路径规则，生态无等价）                                                      |
| **合计** | **≈30 / 75** | 45 条（0.4.0 新增的基本都落在空缺这一列）                                                    |

> **这张表是 0.3.x 的快照**（当时 53 条规则，逐条核对过）；域名后的数字已更新到今天的 74 条，
> 「组合覆盖 ≈N」仍是当年逐条核对的结论 —— 0.4.0 新增的规则归在哪一类，见 `ECOSYSTEM-AUDIT.md` 的修订段。

**一笔隐形成本**：角色表要在 dependency-cruiser / boundaries / project-structure **各写一遍**（= 把契约抄三份）。

### 存量豁免：我们不提供（曾经的差异点，已主动放弃）

生态的存量治理靠各工具自带的 suppressions：eslint 的 `eslint-suppressions.json` 形状是
`{ 文件: { 规则: { count: N } } }` —— **按计数，不按行**（见 `node_modules/eslint/lib/services/suppressions-service.js`）。
推论很直接：**修掉一处、在别处新增一处，计数不变，门禁照样绿。**

本工具一度提供「按行文本哈希锁定」的 `arch.baseline.json`（被豁免那行一改即失效）—— 单看这一条确实比按计数强。
但把机制整体摊开看，它同时满足三件事：**永久**（条目无期限）、**一键重写**（`--update-baseline` 写全部当前违规）、
**锚点被格式化干掉**（跑一次 prettier 就大面积失效）。于是「重新写基线」永远比「修」便宜，
门禁的结论从「符合规范」退化成「没有新增违规」。**我们选择移除整个机制**：违规没有豁免通道，不合规就是红。
唯一例外是 `arch.config.mjs` 的**规则级例外**（`exceptions: [{ rule, glob, reason, expires? }]`）：必须指名规则、必须写理由、可设到期日，每次运行都点名 —— 可见、可评审、**不可能一键扩大**。

## 3. FSD 场景下的组合

FSD（[Feature-Sliced Design](https://feature-sliced.design/)）= 按「层（layer）→ 切片（slice）→ 片段（segment）」三级组织的**前端架构方法论**；
六层：`app / pages / widgets / features / entities / shared`；`app` 与 `shared` 是**无切片层**。

### 3.1 先钉一份路径约定（FSD 不规定令牌/文案放哪）

| 概念              | 落点                                                                              |
| ----------------- | --------------------------------------------------------------------------------- |
| 页面              | `src/pages/<slice>/ui/*`                                                          |
| 业务交互 / 实体   | `src/features/<slice>/{ui,model,api,lib}` · `src/entities/<slice>/{ui,model,api}` |
| 组件库 / 令牌     | `src/shared/ui/**`（UI kit）· `src/app/styles/{tokens,vendor}/**`（项目自定）     |
| 文案              | `src/shared/i18n/locales/<lang>/<ns>.ts`                                          |
| 端点 / 契约       | `src/shared/api/**`                                                               |
| 环境 / 持久化 key | `src/shared/config/**`                                                            |
| 装配              | `src/app/**`（providers / router / styles）                                       |

### 3.2 结构归 steiger

```js
// steiger.config.js
import { defineConfig } from 'steiger'
import fsd from '@feature-sliced/steiger-plugin'

export default defineConfig([
  ...fsd.configs.recommended,
  { ignores: ['**/__mocks__/**'] },
  // 不想每个 shared 片段都建 index.ts 就局部关（FSD 官方文档给的用法）
  { files: ['./src/shared/**'], rules: { 'fsd/public-api': 'off' } },
])
```

steiger 的 20 条规则分三类：**依赖方向**（`forbidden-imports` / `no-higher-level-imports` / `no-cross-imports` / `no-public-api-sidestep` / `import-locality`）、
**结构完整性**（`public-api` / `no-layer-public-api` / `no-segmentless-slices` / `no-segments-on-sliced-layers` / `no-ui-in-app` / `no-reserved-folder-names`）、
**命名与规模**（`ambiguous-slice-names` / `inconsistent-naming` / `repetitive-naming` / `typo-in-layer-name` / `segments-by-purpose` / `insignificant-slice` / `excessive-slicing` / `shared-lib-grouping` / `no-processes`）。

DX 上它比我们强：**每条带文档链接、标 `✔ Auto-fixable`、有 `--fix`、`--watch`、`TIMING` 性能表、规则并发跑**。

> **先读 §3.5 与 §8**：结构声明化落地之后，**我们自己就能表达 FSD**（层号 + 组隔离 + 公开面 → S21/S22/S23），
> 不需要第二个工具。本节只适用于**已经在用 steiger** 的宿主：让它继续管 FSD 细则，我们用 `disable` 避开重复报。
> **新项目不必引入 steiger** —— 走 §3.5 的声明配方即可。

### 3.2.1 与 steiger 的规则对齐（现状）

`fsd()` 预设现在**按规则级对齐**社区 linter，宿主不必再装第二个工具：

| steiger 规则（默认）                                                                                            | 我们                                                           |
| --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `forbidden-imports`                                                                                             | S21 层序 + S22 组隔离                                          |
| `no-higher-level-imports`                                                                                       | S21                                                            |
| `no-cross-imports`                                                                                              | S22                                                            |
| `no-public-api-sidestep`                                                                                        | S23②                                                           |
| `no-wildcard-exports`                                                                                           | S11（默认开，更严）                                            |
| `public-api`                                                                                                    | S23① + S23③（shared 片段同样要公开面）                         |
| `no-layer-public-api` · `no-segments-on-sliced-layers` · `no-ui-in-app` · `typo-in-layer-name` · `no-processes` | S01 封闭角色表                                                 |
| `segments-by-purpose`                                                                                           | S01（白名单而非黑名单：更严、可配）                            |
| `no-segmentless-slices`                                                                                         | **S35**（只有公开面入口的空壳组）                              |
| `no-reserved-folder-names`                                                                                      | **S25**                                                        |
| `insignificant-slice`                                                                                           | **S28**（跨层引用组数下限；`pages` 跳过、只被 `app` 引用放过） |
| `excessive-slicing`                                                                                             | **S26**（同层同桶 > 20）                                       |
| `shared-lib-grouping`                                                                                           | **S27**（`shared/lib` 一级子项 > 15）                          |
| `ambiguous-slice-names`                                                                                         | **S29**（组名 / 组路径段撞真实单元名）                         |
| `repetitive-naming`                                                                                             | **S30**                                                        |
| `inconsistent-naming`                                                                                           | **S31**（词形判据 = `src/data/plural-forms.ts` / pluralize）   |
| `import-locality`                                                                                               | **S32**（默认关，同社区）                                      |

**编号说明**：社区 linter 没有规则编号，本仓的 `S24` 是「契约扫描域不得为空」，所以"组必须有片段"落 **S35**。

**三处有意更严**（写在这里免得踩坑）：`index.css` 这类非代码 `index.*` 不算公开面；重名词汇表只收**真实存在**的单元目录；
`shared/<段>.ts`（shared 根下的散文件）仍是 S01 —— 官方的文件系统模型认它，我们要求片段按目录组织。

**不追的 DX**：`--watch` / `--fix` / 每条规则的文档链接 / 规则并发跑（判据等价即可，报文不照抄）。

### 3.3 已用 steiger 的宿主：契约层接我们（实测零重叠）

**装什么**

```bash
# npm：装 steiger 即可
npm i -D steiger @arch-guard/core

# pnpm：插件必须**显式**装成直接依赖 —— 严格 node_modules 不提升传递依赖，
#       否则配置里 import fsd from '@feature-sliced/steiger-plugin' 解析不到
pnpm add -D steiger @feature-sliced/steiger-plugin @arch-guard/core
```

**steiger 侧（结构层）**

```js
// steiger.config.mjs  ← 必须 .mjs，或在 package.json 里设 "type": "module"；
//   用 .js 且没设 type 时 steiger 会报 Failed to load the ES module
import { defineConfig } from 'steiger'
import fsd from '@feature-sliced/steiger-plugin'

export default defineConfig([...fsd.configs.recommended, { ignores: ['**/__mocks__/**'] }])
```

**我们这侧（契约层 + 兜底枚举）**

```js
// arch.config.mjs
import {
  copy,
  deps,
  designSystem,
  hygiene,
  library,
  noneKit,
  reactPack,
  uiKit,
} from '@arch-guard/core'

// 一份目录事实：FSD 六层 + 层号（越小越底层）
const FSD_LAYERS = { shared: 1, entities: 2, features: 3, widgets: 4, pages: 5, app: 6 }

export default {
  packs: [reactPack],
  presets: [
    // ① 六层当"目录表"：只做两件事 —— 兜住**层外文件**（S01）+ 提供层号。
    //    entry 必须置空：FSD 的入口在 app/ 层内，否则 app/index.tsx 同时命中 entry 与 app 两个角色
    library({ modules: FSD_LAYERS, entry: [] }),

    // ② 契约域：**声明即启用**（各域预设的规则集取并集，不用手写 enable 清单）
    designSystem({
      styleDir: 'src/app/styles', // 全局样式归官方 app 片段
      tokenDir: 'src/app/styles/tokens', // 令牌与第三方覆盖也归官方 app 片段
      paletteFile: 'src/app/styles/tokens/palette.css',
      themeFile: 'src/app/styles/tokens/theme.css',
      storageFile: 'src/shared/config/storage.ts',
    }),
    copy(),
    i18n(i18nextKit({ resourceDir: 'src/shared/i18n/locales', languages: ['zh-CN', 'en'] })),
    deps({ allow: ['react', 'react-dom', 'react-router'] }),
    hygiene(),
    uiKit(noneKit()), // 或 uiKit(antdKit()) —— 按项目实际的组件库
  ],

  overrides: {
    // ③ 关掉与 steiger 重复的那条：S21 层序单向 ←→ fsd/forbidden-imports
    //    若 FSD 公开面坚持用 `export *`，把 S11 一起关：disable: ['S11', 'S21']
    disable: ['S21'],
  },
}
```

```jsonc
// package.json
"scripts": { "check": "steiger ./src && arch-guard" }
```

> **别用细粒度角色表。** §3.5 那份 27 条（层 × 切片 × 片段）是"我们**自己**完整实现 FSD"用的；
> steiger 在场时它只会和 `segments-by-purpose` / `public-api` 重复报。**粗粒度六层足够** ——
> FSD 的切片 / 片段 / 公开面细则全归 steiger。

**实测分工**（同一个 FSD 项目、两侧同时注入违规）：

| steiger（结构层，14 条）                | 我们（契约层 + 兜底枚举，10 条）                         |
| --------------------------------------- | -------------------------------------------------------- |
| `forbidden-imports` ×2（层序 + 跨切片） | `S01` 层外文件 `src/utils.ts` —— **steiger 对它 0 命中** |
| `no-public-api-sidestep` ×3             | `D05` 死令牌 ×2                                          |
| `public-api` ×7                         | `C03` 缺键 · `C05` 分片未聚合 ×2 · `C06` 死键 ×3         |
| `insignificant-slice` ×1                | `P01` 未登记的运行时依赖                                 |
| `segments-by-purpose` ×1                | —                                                        |

**零重叠**，而且是互补的：**它管 FSD 的层内细则，我们管"文件根本不在任何层里"与跨文件契约。**

</details>

### 3.4 组合时踩过的坑（都是实测）

| 坑                        | 症状                                                   | 解法                                                                     |
| ------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------ |
| ESM 配置                  | `Failed to load the ES module: steiger.config.js`      | 用 `steiger.config.mjs` 或设 `"type": "module"`                          |
| pnpm 严格依赖             | `Cannot find package '@feature-sliced/steiger-plugin'` | 插件显式装成 devDependency                                               |
| `entry` 没置空            | 报「角色歧义：同时命中 lib:entry / lib:app」           | `entry: []`                                                              |
| S21 与 steiger 重复       | 同一条越层依赖两边各报一次                             | `disable: ['S21']`                                                       |
| `export *` 冲突           | 我们报 S11，而 FSD 认为 `index.ts` 就是公开面          | `disable: ['S11', 'S21']` 或坚持具名导出                                 |
| i18n 形态                 | C 域整块失效                                           | locales 必须是 `<lang>/<ns>.ts` **默认导出嵌套对象** + `<lang>/index.ts` |
| **别用 `\| grep` 跑门禁** | 管道吃掉崩溃、退出码还是 0                             | 直接跑，或 `set -o pipefail`                                             |

（早前版本的阻塞点「`enable` 是覆盖不是并集」已修：现在多预设取并集，`designSystem()` / `copy()` / `deps()` 声明即启用，
不再需要手抄 40 个 id 的清单。）

### 3.5 FSD 就这么配（`fsd()` 预设，已实测）

```js
// arch.config.mjs —— FSD 项目的全部配置
import { fsd, i18nextKit, noneKit, reactPack, stack } from '@arch-guard/core'

export default {
  packs: [reactPack],
  presets: [
    fsd(), // ← 六层 + 切片 + 片段 + 公开面，**连契约落点一起声明**
    // 落点不用手写：`fsd()` 已声明 FSD 的惯用位置 —— 全局样式 / 令牌 / 第三方覆盖三处都在官方
    // app 片段的 `src/app/styles` 下（shared 的段要按用途命名，没有"样式"这个段名）、
    // storage key `src/shared/config/storage.ts`。
    // 域轴用**组合方案**拼（等价于手写 designSystem()/copy()/deps()/hygiene()/i18n()/uiKit()）：
    ...stack({
      i18n: i18nextKit({ languages: ['zh-CN', 'en'] }), // 不用 i18n 就传 i18n: noneI18nKit()
      uiKit: noneKit(), // 用 antd 就换 antdKit()：换库只改这一行
      deps: { allow: ['react', 'react-dom', 'react-router'] },
    }),
  ],
}
```

`fsd()` 把 FSD 的三层模型全部落成**数据**（45 条角色描述符）：

| FSD 概念                                         | 落成什么                                                                                     |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| 层（app/pages/widgets/features/entities/shared） | 角色描述符的 `layer` 号（越小越底层）                                                        |
| 切片（`pages/crews`）                            | `group: 'slice'`（组维度）· 分组切片用 `fsd({ slicesGrouped: true })`                        |
| 片段（ui/model/api/lib/config）                  | **封闭枚举**的角色 — 没登记的片段（`components`…）由 S01 报出来                              |
| 公开面（切片根的 `index.ts`）                    | `entry: true`                                                                                |
| 层序 / 跨切片禁令 / 公开面必须存在且不许绕过     | `structure: { order: true, isolate: ['slice'], publicApi: ['slice'] }` → **S21 / S22 / S23** |

夹具 [`__fixtures__/fsd-preset`](../__fixtures__/fsd-preset) 实测（合规的一条不报）：

| 注入的违规                                                 | 报出              |
| ---------------------------------------------------------- | ----------------- |
| `pages/crews` → `pages/dashboard`（同层跨切片 + 直引内部） | **S22** + **S23** |
| `pages/dashboard` 没有 `index.ts`                          | **S23**           |
| `shared/lib` → `pages/crews/ui`（向上依赖 + 绕过公开面）   | **S21** + **S23** |
| `pages/crews/components/Nope.tsx`（没登记的片段）          | **S01**           |

> 若项目坚持在公开面里用 `export *`，加 `overrides: { disable: ['S11'] }`（S11 禁 barrel 是我们更严的一条）。

#### 片段名字要过 `segments-by-purpose`

FSD 用**黑名单**判"按内容命名"（社区官方 linter steiger 的
[`segments-by-purpose`](https://github.com/feature-sliced/steiger/tree/master/packages/steiger-plugin-fsd/src/segments-by-purpose)）：

> `components` · `helpers` · `utils` · `constants` · `types` · `stores` · `modals` · `services` · `functions` ·
> `classes` · `enums` · `interfaces` · `decorators` · `schemas` · `handlers` · `fixtures` · `middlewares` ·
> `validators` · `resolvers` · `mutations` · **`assets`** · （React）`hooks` · `context` · **`providers`** ·
> （Vue）`composables` · `directives`

黑名单**没有** `styles` / `router` / `i18n` / `config` / `ui` / `lib` / `api` / `model` —— 所以 `shared/styles` 合规。
但 `assets` 与 `providers` **在**名单里，因此 `fsd()` 的默认片段**故意不含这两个**（它们太常见，很多项目会踩）：

```js
fsd() // 默认：官方典型段（shared: ui/lib/api/config/routes/i18n；app: router/routes/store/styles/entrypoint/i18n）
fsd({ sharedSegments: ['ui', 'lib', 'api', 'config', 'i18n', 'routes', 'styles'] }) // 加自定义片段（styles 合规）
fsd({ appSegments: ['router', 'routes', 'store', 'styles', 'entrypoint', 'i18n', 'providers'] }) // 明知会被 linter 警告才这么写
```

#### 与官方规范 v2.1 的对照（逐条，含回归测试）

| 官方规范（[layers](https://feature-sliced.design/docs/reference/layers) · [slices-segments](https://feature-sliced.design/docs/reference/slices-segments) · [public-api](https://feature-sliced.design/docs/reference/public-api)） | 本预设                                     | 说明                                                                                                                    |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| 七层：App · Processes**（已弃用）** · Pages · Widgets · Features · Entities · Shared                                                                                                                                                | ✅ 六层                                    | `processes` 官方已建议避免，默认不含；要就 `slicedLayers` 加回                                                          |
| 切片只能引用**严格更下层**的切片                                                                                                                                                                                                    | ✅ S21（层号 ≤ 自己）+ S22（同层切片隔离） | 两条合起来等价于"严格向下"                                                                                              |
| App / Shared 是"层即切片"、只有片段、**片段间可自由互引**                                                                                                                                                                           | ✅                                         | 两者角色同层号 → S21 放行；S22 不作用于它们（无切片维度）                                                               |
| 切片只在 pages / widgets / features / entities                                                                                                                                                                                      | ✅                                         |                                                                                                                         |
| 每个切片必须有公开面（`index.ts`），外部只能经它引用                                                                                                                                                                                | ✅ S23                                     | 外加 S11 禁 `export *`（官方把通配再导出也列为坏实践）                                                                  |
| 环境特定公开面 `index.server.ts` / `index.client.ts`                                                                                                                                                                                | ✅                                         | 本轮补上                                                                                                                |
| 切片可分组，组文件夹里**不许共享代码**                                                                                                                                                                                              | ✅ `slicesGrouped`                         | 组文件夹里的散件直接 S01                                                                                                |
| 官方片段：`ui` / `api` / `model` / `lib` / `config`                                                                                                                                                                                 | ✅ 默认集完全一致                          |                                                                                                                         |
| shared 典型段 `api`/`ui`/`lib`/`config`/`routes`/`i18n`；app 典型段 `routes`/`store`/`styles`/`entrypoint`                                                                                                                          | ✅ 都认                                    | 另保留本仓既有的 `router` / `i18n`                                                                                      |
| "你可以自由加片段"（按用途命名）                                                                                                                                                                                                    | ⚠️ **封闭枚举**：没登记 → S01              | 本仓 D3（白名单 > 黑名单）；用 `segments` / `appSegments` / `sharedSegments` 显式加                                     |
| **`@x` 跨引用公开面**（entities 之间）                                                                                                                                                                                              | ❌ **未实现**                              | 官方唯一的"同层跨切片"合法通道。要做得给 S22 开例外并限制在 entities 层；当前替代是把它提到更高层（官方也说"尽量少用"） |

> 对照有回归保护：`tests/fsd-conformance.test.mjs` —— 官方写法必须不被误报；`@x` 的当前行为也被**故意钉住**，实现后必须改那条断言。

`uiKit(…)` 是**正交轴**（组件库 ≠ 目录规范）：不用组件库写 `uiKit(noneKit())`，用 antd 写 `uiKit(antdKit())`
（换库只改这一行；自研设计系统也可以只写一个 adapter 对象）。它同时声明了读它的那 5 条规则（D10/D10b/P05/P11/H06）——
**别只装适配器不启用规则**，那是静默失效（已由守卫测试锁住）。Tailwind + shadcn 的项目另有 `@shadcn/lint` 管类名层面的约束（见 §1）。

**它检查不了的**：`insignificant-slice`（死切片）、`excessive-slicing`（切片过多）、复数一致等**阈值/词形**类 ——
那些判不准，我们不放进红线（要的话自己装 steiger，见 §3.3）。

<details>
<summary>展开：不用预设时，手写角色表长什么样</summary>

### 3.5.1 用现有能力定义 FSD：能定义多少（实测）

**27 条角色描述符**就能钉住 FSD 的"可判定部分"（零引擎改动）：

```js
export default {
  presets: [
    library({
      modules: { shared: 1, entities: 2, features: 3, widgets: 4, pages: 5, app: 6 },
      entry: [],
    }),
    hygiene(),
  ],
  overrides: {
    roles: [
      { id: 'test', pattern: '**/*.test.{ts,tsx}', layer: 99, exclusive: true },

      // ① 无切片层（app / shared）：直接就是片段
      { id: 'fsd:app:root', pattern: 'src/app/index.{ts,tsx}', layer: 6, slot: 'root' },
      { id: 'fsd:app:providers', pattern: 'src/app/providers/**', layer: 6, slot: 'providers' },
      { id: 'fsd:app:router', pattern: 'src/app/router/**', layer: 6, slot: 'router' },
      { id: 'fsd:app:styles', pattern: 'src/app/styles/**', layer: 6, slot: 'styles' },

      // ② 有切片的层：切片 → 片段（**片段封闭枚举**：没列到的片段一律 S01）
      { id: 'fsd:pages:ui', pattern: 'src/pages/{slice}/ui/**', layer: 5, slot: 'ui' },
      { id: 'fsd:pages:model', pattern: 'src/pages/{slice}/model/**', layer: 5, slot: 'model' },
      { id: 'fsd:pages:api', pattern: 'src/pages/{slice}/api/**', layer: 5, slot: 'api' },
      { id: 'fsd:pages:lib', pattern: 'src/pages/{slice}/lib/**', layer: 5, slot: 'lib' },
      // widgets(4) / features(3) / entities(2) 同形，各列 ui / model / api / lib

      // ③ shared：无切片层，直接是片段
      { id: 'fsd:shared:ui', pattern: 'src/shared/ui/**', layer: 1, slot: 'ui' },
      { id: 'fsd:shared:lib', pattern: 'src/shared/lib/**', layer: 1, slot: 'lib' },
      { id: 'fsd:shared:api', pattern: 'src/shared/api/**', layer: 1, slot: 'api' },
      { id: 'fsd:shared:config', pattern: 'src/shared/config/**', layer: 1, slot: 'config' },
    ],
  },
}
```

三条违规同时注入的实测结果：

| FSD 规矩                                                 | 注入的违规                                              | 我们报吗                                     |
| -------------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------- |
| 层封闭枚举                                               | 层外文件                                                | ✅ S01                                       |
| **片段按用途封闭枚举**（`segments-by-purpose` 的闭集版） | `pages/crews/components/Bad.tsx`（没登记 `components`） | ✅ **S01**                                   |
| 层序单向                                                 | `entities`(2) 引 `features`(3)                          | ✅ **S21**「反向依赖：第 2 层引用了第 3 层」 |
| **同层切片互不引用**（`no-cross-imports`）               | `pages/crews` 引 `pages/dashboard`                      | ❌ **不报**                                  |

**定义不了的两条，根因是两个引擎缺口**：

1. **切片维度丢失**：`{slice}` 捕获被丢掉（`src/engine/scan.ts` 只保留固定名 `domain`）→ 规则拿不到切片名，
   写不出"切片 A 不许引切片 B"；
2. **没有公开面规则**：缺"某组必须有 `index.ts`"与"到组内部的边必须经由 `index.ts`"两条。

（启发式那几条 —— `insignificant-slice` / `excessive-slicing` / 复数一致 —— 仍归 steiger，别自己写。）
补齐这两个缺口就是 §8「结构声明化」的内容；补完后 FSD 的结构层可判定部分就完整了，
同一套能力也能表达三根拓扑与自研分层。

### 3.4 四个必须知道的坑（都是实测出来的）

1. ~~`enable` 是"覆盖"不是"并集"~~ **已修**：多个预设的 `enable` 现在取**并集**，且各域预设（`designSystem()` / `copy()` / `deps()` / `metrics()` / `hygiene()`）会**声明自己贡献哪几条规则**。
   旧行为下 `library() + designSystem() + copy()` 只启用 10/53 条（D/C/M 域被静默关掉），必须手抄 40 个 id 的并集；现在写预设就够了。要**减**法用 `overrides.disable`。
2. **`entry: []` 必须置空** —— 否则 `src/app/index.tsx` 同时命中 `lib:entry` 与 `lib:app`，报「角色歧义」。
3. **`S11 禁 barrel` 与 FSD 公开面冲突** —— FSD 的 `index.ts` 常用 `export *`，我们禁它（会让依赖图不可判定）。二选一。
4. **i18n 形态是硬约定** —— 我们要 `<resourceDir>/<lang>/<ns>.ts` **默认导出嵌套对象** + `<lang>/index.ts` 聚合；FSD 项目若用扁平键/JSON，C 域失效。

## 4. steiger 的边界：对非 FSD 项目**静默假绿**

实测：把一个标准的 `canonical()` 项目（`src/app` + `src/modules` + `src/shared`）交给 steiger：

```
✔ No problems found!
退出码=0
```

**这不是"管得少"，是静默通过。** 同一个工具在真正的 FSD 项目上报了 **10 条**。

原因：它只认 FSD 的层/切片/片段模型，`modules/` 这种目录它没有对应概念，于是"没有发现" = "通过"。
这与我们刚给 S20 / `metaFramework` 立的规矩正好相反 —— **我们"量不了"会明确报错，不会给假绿**。

### FSD 覆盖不到的四类

| 类型                                               | 为什么                                                                                  |
| -------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **库 / SDK / 组件库**                              | 没有 pages/widgets/features/entities，只剩 `shared` —— "层"这一维不存在                 |
| **框架文件路由**（Next App Router / Nuxt / Remix） | 框架自己规定 `app/` `pages/` `routes/`，与 FSD 同名不同义                               |
| **已有自研分层**                                   | `components/ hooks/ services/ utils/` 平铺、Atomic Design、Clean Architecture、DDD 分层 |
| **非应用型前端**                                   | 浏览器插件、Electron 壳、微前端基座、设计系统仓库                                       |

量级也印证：`dependency-cruiser` 287 万/周、`eslint-plugin-boundaries` 110 万/周 vs **steiger 6 万/周**。

## 5. dependency-cruiser vs steiger

> **2026-09-24 更新**：dependency-cruiser 三件"我们原来没有"的图能力已收回本体 ——
> **依赖环 → S08**（`graph.cycles`）、**文件级入/出度阈值 → S34**（`structure.degreeLimits`）。
> （**未解析导入原先也收回了本体（S33），0.4.0 又交回生态**：`import/no-unresolved` 更成熟，见 DESIGN §4.9。）
> 仍留给它的只剩**依赖图可视化**（`--format dot`）：那是"看"的工具，门禁是"判"的工具。

|          | dependency-cruiser                                                                                                                                                        | steiger                                                                    |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 角色     | 像 `eslint` **本体** —— 执行**你定义的**规范                                                                                                                              | 像 `eslint-config-airbnb` —— 一套**既有规范**的执行器                      |
| 配置     | `forbidden` / `allowed` / `required`                                                                                                                                      | 插件自带规则 + 按文件开关                                                  |
| 判据     | `path` / `pathNot`（**支持 `$1` 分组反向引用**）、`orphans`、`reachable`、`numberOfDependents*`、`couldNotResolve`、`circular`、`ancestor`、`scope`（可作用于**文件夹**） | FSD 语义（切片/片段/公开面）                                               |
| 独有     | **反向"必须有依赖" `required`**、**入度阈值**、文件夹级规则、**依赖图可视化**                                                                                             | 切片/片段语义、命名与复数一致、死切片、过度切片、`--fix`、agent 友好的报错 |
| FSD 项目 | **重复** —— 官方文档的 "matching peer folders"（`$1`）示例就是"同层切片不许互引"                                                                                          | 内置且零配置                                                               |

**结论**：FSD 项目用 steiger 就够，再写一遍 dependency-cruiser 规则 = 手工重抄 FSD 规范；
非 FSD 项目 steiger 完全不管，只能用 dependency-cruiser + boundaries + project-structure。

## 6. 组合（任何变体）都覆盖不到的

1. **跨文件令牌图**：跨文件悬空 `var()`、死令牌、明暗两套令牌名一致
2. **跨语言一致性**：TS 常量 ↔ CSS ↔ `index.html` 内联脚本 ↔ locales（D08、C05）
3. **声明 ⇄ 事实**：声明了 i18n / 设计系统 / 组件库却零事实（C07 / D21 / P11）
4. **依赖选型体系**：能力表、适配表 ⇄ 实际依赖对账、图标来源唯一、手搓轮子指纹（P 域生态**一条都没有**）
5. **CSS Module 双向契约**（D17）、文案一文件一命名空间与分片聚合（C04/C05）
6. **零容忍**：违规没有存量豁免（没有「一键洗白」通道），结论只有「符合规范」与「不符合」两种
7. **判定纪律**：error 只落 L1–L3（`createRule` 代码强制）+ 每条规则必须带"违规必报 × 合规不报"夹具

## 7. 定位启示

- **目录规范是团队选择，契约层才是跨方法论通用的**。FSD 团队和 Next 团队目录完全不同，但都需要同一套契约层。
- 我们的 `canonical()` 三根会排除"其他前端"（他们得先迁目录）—— 这是当前最大的接入阻力。
- 空位很清楚：**§6 那七项**。要么把定位收敛到契约层，要么把目录规范那层做成"可声明的通用能力"（见 §8）。

## 8. 结构声明化（structure as data）—— **已实现**

**已落地**（2026-09-23，规格 [`.scratch/structure-as-data/spec.md`](../.scratch/structure-as-data/spec.md)）：

| 声明                             | 判它的规则                                                               |
| -------------------------------- | ------------------------------------------------------------------------ |
| `structure.order: true`          | **S21** 层序单向                                                         |
| `structure.isolate: ['slice']`   | **S22** 组隔离（同维度、同层、不同组不许互引）                           |
| `structure.publicApi: ['slice']` | **S23** 公开面（组必须有入口 + 禁绕过；入口由角色表 `entry: true` 标记） |

record 现在携带 `captures` / `group` / `groupName`；组与入口名全部来自**角色表数据**，引擎里没有任何方法论字面量。
**原计划的第二个缺口（目录枚举）被设计消解**：组由文件派生（没文件的目录不构成组），
所以"组缺入口"用文件集就能判定，不需要扫目录。

**问题（回顾）**：原先 S 域是**内置范式**（三根 + 固定槽位 + `layout` 三个根）。要支持 FSD / 自研分层，两条路：

| 路线                        | 做法                                                                      | 代价                                                                                               |
| --------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| ❌ 内置 FSD 范式            | 写 `fsd()` 预设 + 约 15 条 FSD 规则                                       | 重做半个 steiger；跟别人的规范演进；与"契约层"定位冲突；只惠及一种方法论；仍缺 `--fix` / `--watch` |
| ✅ **结构声明化（已实现）** | 把结构检查从内置范式改成**宿主声明的角色表 + 关系**，规则全部从角色表推导 | 引擎两处改造 + 3 条方法无关的通用规则（S21/S22/S23）                                               |

声明形态（草案）：

```js
structure: {
  order:   ['shared', 'entities', 'features', 'widgets', 'pages', 'app'], // 层序：只许向下
  isolate: ['pages', 'widgets', 'features', 'entities'],                 // 同层互不引用（= FSD 跨切片）
  publicApi: { role: 'fsd:pages', entry: 'index.ts' },                   // 公开面 + 禁 sidestep
  slots:   { 'fsd:pages': ['ui', 'model', 'api', 'lib', 'config'] },     // 组内槽位封闭枚举
}
```

四条**方法无关**的通用规则即可撑住结构那半：

| 通用规则          | 表达                      | FSD 里对应                                             | 我们三根里对应            |
| ----------------- | ------------------------- | ------------------------------------------------------ | ------------------------- |
| `layer-order`     | 层序单向                  | 层只能向下                                             | shared 0–8 线性层序       |
| `slice-isolation` | 同层互不引用              | 跨切片禁止                                             | 域间零依赖（S05/S06）     |
| `public-api`      | 组必须有入口 + 禁直引内部 | `index.ts` / `no-public-api-sidestep`                  | 域唯一公开面 `routes.tsx` |
| `slot-enum`       | 组内槽位封闭枚举          | `segments-by-purpose` / `no-segments-on-sliced-layers` | 域内七槽位                |

### 先例：这种引擎别处早就有了（且形状一致）

"兼容所有规范的引擎"不是新想法 —— **其他生态有教科书级先例，而且它们抽象出的是同一个形状**：

| 工具                                   | 生态        | 声明形态                                                                                                                      |
| -------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **ArchUnit**                           | Java        | `layeredArchitecture().layer("Controller").definedBy("..controller..").whereLayer("Controller").mayNotBeAccessedByAnyLayer()` |
| **import-linter**（v2.15）             | Python      | `[importlinter:contract:layers]` + `layers = a \| b \| c`；另有 `forbidden` / `independence` 契约                             |
| **go-arch-lint**                       | Go          | YAML 声明组件 + 允许的依赖                                                                                                    |
| **Nx `@nx/enforce-module-boundaries`** | JS monorepo | **tag + `depConstraints`**（`onlyDependOnLibsWithTags`）—— 最接近通用"标签 + 约束"引擎                                        |

四者共同的抽象，正是 §8 的四个字段：

1. **主体 → 组 的映射**（`definedBy("..controller..")` / `tags`）→ 我们的**角色表**
2. **组间关系**（`mayNotBeAccessedBy` / `forbidden` / `depConstraints`）→ `isolate` / `order`
3. **层的顺序**（`layeredArchitecture` / `layers` 契约）→ `order`
4. **组的入口 / 公开面**（boundaries 的 `entry-point`、import-linter 的 `independence`）→ `publicApi`

**JS/TS 侧只有"半个"**（周下载为 2026-09 last-week）：

| 包                                | 周下载    | 覆盖到哪一层                                                                     |
| --------------------------------- | --------- | -------------------------------------------------------------------------------- |
| `eslint-plugin-boundaries`        | 1,099,071 | element-types / entry-point / external                                           |
| **`@boundaries/elements`**        | 994,018   | **"Element descriptors and matchers"** —— 把"映射"拆成独立引擎包，最接近"引擎库" |
| `dependency-cruiser`              | 2,874,211 | 通用图引擎，但规则要手写正则（没有"规范"抽象）                                   |
| `eslint-plugin-project-structure` | 49,026    | `folder-structure` + `file-composition`，"Create your own framework"             |
| `archlint`                        | 10        | 2019 年起停更                                                                    |

**为什么 JS/TS 没长出成熟的**：① ESLint 生态偏好"装上就有一堆规则"（airbnb / next 模式），通用引擎"零规则全靠声明"卖点弱
（dependency-cruiser 靠**依赖图可视化**这个第二卖点活下来）；② 团队觉得"自己写几条规则就行"，于是每家抄一份角色表；
③ TS 解析生态碎片化（tsc / oxc / swc / tree-sitter）——**这条我们恰好绕过了**：规则只消费归一化 facts，换 parser 不动规则；
④ **没人把"结构 + 契约"接在一起** —— 结构有工具、契约（令牌/文案/依赖/度量）没有，完整架构门禁这个位置一直空着。

**我们比对手多的四样**：**零容忍判定**（没有可刷的存量清单）、**能力协商**、
**判定等级纪律 + 每条规则必须带夹具**、**跨语言事实**（TS ↔ CSS ↔ HTML ↔ locales）。
而对手做不到的是：**同一份声明同时驱动结构规则与契约规则**（共享同一套角色表、facts、报告）。

**硬边界**：只能兼容规范的**可判定部分（L1–L3）**。"这个 feature 必须是一个用户动作"（FSD）、
"这个组件是 molecule 还是 organism"（Atomic Design）是 L5，**任何引擎都判不了** —— 不是我们弱，是问题不可判定。
所以承诺要写成：**把任何目录规范里可判定的那部分变成红线**。

**可验收的定义**：同一份引擎，用三份声明分别表达「三根拓扑」「FSD」「Atomic Design」，各自夹具通过，
**切换声明不改一行引擎代码**。

### 引擎缺口（现状）

1. ✅ **多维捕获**：`FileRecord.captures` 携带全部 `{name}` 捕获，并派生 `group` / `groupName`。
2. ✅ **关系声明**：`StructureSpec`（`order` / `isolate` / `publicApi`）三个字段各有一条规则消费（S21/S22/S23）。
3. ❌ **目录枚举**：原以为要扫目录才能查"空切片 / 缺 index"—— 设计后消解：组由文件派生，不必扫目录。
4. ❌ **不写 FSD 的启发式规则**：`insignificant-slice`、`excessive-slicing`、复数一致那些仍归 steiger。
5. ❌ 我们**没有** `--fix` 与 `--watch`。（fixer × 棘轮的冲突已随基线移除而消失，但 `--fix` 仍不在 v1 范围。）
6. ✅ `canonical()` 已迁移到通用规则：应用范式声明 `structure: { order: true }`，层序由 **S21** 判；原先 shared 专属的 **S07 已删**
   （顺带补上原先没人管的 `shared → modules`、`modules → app` 向上依赖）。

> 结论：**"用我们 = 引擎"而不是"用我们 = 接受三根拓扑"**。这一步做完，FSD 与"其他前端"都进得来，
> 而且不必重做 steiger。

## Comments

- 2026-09-23 成文：来自"成熟工具组合 → FSD 组合 → steiger 的边界 → 能否实现 FSD"这一串讨论。
  所有下载量为该日 npm last-week 数据；steiger 的行为、我们的 FSD 配方、`enable` 阻塞点、
  `entry: []` 的角色歧义均为**本地实测**。
- 2026-09-23 **结构声明化已实现**（§8）：`structure: { order, isolate, publicApi }` + S21/S22/S23 + 夹具 `structure-isolate` / `structure-public-api`。
