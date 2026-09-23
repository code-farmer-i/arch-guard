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
| 拼不出来的               | **跨文件令牌图、跨语言一致性、声明⇄事实、依赖选型体系、统一棘轮、判定纪律**               |
| FSD 项目怎么办           | 结构交 `steiger`；契约层可以接我们（`library({ modules: 六层, entry: [] })`），实测零重叠 |
| 我们的定位启示           | **目录规范是团队选择，契约层才是跨方法论通用的** —— 见 §8                                 |

---

## 1. 逐条对照：我们的能力生态里谁在做

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
| **棘轮**        | **eslint 内置 `--suppress-all` / `--prune-suppressions`** + **stylelint 内置 `--suppress`**                                                    | 存量治理                                                              |

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

| 域       | 组合覆盖     | 空缺                                           |
| -------- | ------------ | ---------------------------------------------- |
| S（19）  | ≈12          | **S11 禁 barrel**（生态无等价）、S18、S19、S20 |
| D（12）  | ≈5           | D03、**D05**、D06、D08、D16、**D17**、D21      |
| C（6）   | ≈4           | C04、C05、C07                                  |
| P（7）   | ≈2           | **P01/P04/P05/P06/P07/P11 全空**               |
| M（8）   | ≈4           | M06、M07、M08、M09                             |
| H        | 全覆盖       | —                                              |
| **合计** | **≈30 / 53** | 23 条                                          |

**两笔隐形成本**：① 角色表要在 dependency-cruiser / boundaries / project-structure **各写一遍**（= 把契约抄三份）；
② **基线是散的** —— eslint 一份、stylelint 一份、覆盖率一份，没有跨工具的单一债务视图。

### 棘轮的真实差距（实测）

eslint 的 `eslint-suppressions.json` 形状是 `{ 文件: { 规则: { count: N } } }` —— **按计数，不按行**
（见 `node_modules/eslint/lib/services/suppressions-service.js`）。推论：

> 修掉一处、**在别处新增一处**，计数不变，门禁照样绿。

我们的棘轮锚点是**规范化行文本哈希**：被豁免那行一改，豁免立即失效。这是"防绕过"上的实质差别，不是口味。

## 3. FSD 场景下的组合

FSD（[Feature-Sliced Design](https://feature-sliced.design/)）= 按「层（layer）→ 切片（slice）→ 片段（segment）」三级组织的**前端架构方法论**；
六层：`app / pages / widgets / features / entities / shared`；`app` 与 `shared` 是**无切片层**。

### 3.1 先钉一份路径约定（FSD 不规定令牌/文案放哪）

| 概念              | 落点                                                                              |
| ----------------- | --------------------------------------------------------------------------------- |
| 页面              | `src/pages/<slice>/ui/*`                                                          |
| 业务交互 / 实体   | `src/features/<slice>/{ui,model,api,lib}` · `src/entities/<slice>/{ui,model,api}` |
| 组件库 / 令牌     | `src/shared/ui/**` · `src/shared/ui/styles/tokens/**`（项目自定）                 |
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

### 3.3 契约层接我们（实测零重叠）

```js
// arch.config.mjs —— FSD 宿主
import {
  copy,
  deps,
  designSystem,
  hygiene,
  library,
  noneKit,
  reactPack,
  uiKit,
} from 'arch-guard/presets'

export default {
  packs: [reactPack],
  presets: [
    // 六层当"目录表"；**entry 必须置空**（否则 app/index.tsx 同时命中 entry 与 app 两个角色）
    library({
      modules: { shared: 1, entities: 2, features: 3, widgets: 4, pages: 5, app: 6 },
      entry: [],
    }),
    designSystem({
      styleDir: 'src/shared/ui/styles',
      tokenDir: 'src/shared/ui/styles/tokens',
      paletteFile: 'src/shared/ui/styles/tokens/palette.css',
      themeFile: 'src/shared/ui/styles/tokens/theme.css',
      storageFile: 'src/shared/config/storage.ts',
    }),
    copy({ resourceDir: 'src/shared/i18n/locales', languages: ['zh-CN', 'en'] }),
    deps({ allow: ['react', 'react-dom', 'react-router'] }),
    hygiene(),
    uiKit(noneKit()),
  ],
  // 不需要手写 enable 清单：`library()` 与各域预设的规则集是**并集**（见「四个坑」第 1 条）。
  // 结构交给 steiger，这里只留兜底枚举与跨文件契约。
  overrides: {
    // 若 FSD 的公开面坚持用 `export *`，再把 S11 关掉（见「四个坑」第 3 条）
    // disable: ['S11'],
  },
}
```

**实测结果**（同一个项目、同一条命令）：

| 我们（契约层）                                                        | steiger（结构层）                                                  |
| --------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `D04` 未定义令牌引用 · `D05` 死令牌 ×2 · `D17` CSS Module 无人 import | `forbidden-imports` 跨 slice 引用 · `no-public-api-sidestep`       |
| `C03` en 缺键 · `C05` 分片未聚合 · `C06` 死键 ×3                      | `public-api` ×3 · `insignificant-slice` ×2 · `segments-by-purpose` |
| `P01` 未登记的运行时依赖                                              | —                                                                  |

**零重叠** —— 分工成立。

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
6. **统一棘轮**：跨工具的单一债务视图 + 按行锚点（对比 eslint 的按计数）
7. **判定纪律**：error 只落 L1–L3（`createRule` 代码强制）+ 每条规则必须带"违规必报 × 合规不报"夹具

## 7. 定位启示

- **目录规范是团队选择，契约层才是跨方法论通用的**。FSD 团队和 Next 团队目录完全不同，但都需要同一套契约层。
- 我们的 `canonical()` 三根会排除"其他前端"（他们得先迁目录）—— 这是当前最大的接入阻力。
- 空位很清楚：**§6 那七项**。要么把定位收敛到契约层，要么把目录规范那层做成"可声明的通用能力"（见 §8）。

## 8. 候选方向：结构声明化（structure as data）

**问题**：现在 S 域是**内置范式**（三根 + 固定槽位 + `layout` 三个根）。要支持 FSD / 自研分层，两条路：

| 路线              | 做法                                                                      | 代价                                                                                               |
| ----------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| ❌ 内置 FSD 范式  | 写 `fsd()` 预设 + 约 15 条 FSD 规则                                       | 重做半个 steiger；跟别人的规范演进；与"契约层"定位冲突；只惠及一种方法论；仍缺 `--fix` / `--watch` |
| ✅ **结构声明化** | 把结构检查从内置范式改成**宿主声明的角色表 + 关系**，规则全部从角色表推导 | 引擎两处改造 + 4 条方法无关的通用规则                                                              |

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

### 已知的引擎缺口（实现前必须知道）

1. **多维捕获**：`FileRecord` 只带 `domain`（固定名）+ `slot`（见 `src/engine/scan.ts`）——
   FSD 需要「层 + 切片 + 片段」三个维度 → 要携带任意捕获。
2. **关系声明**：`layout` 只有 `{app, modules, shared}` 三个根，S03–S09/S15/S18 都从它推导 →
   层序 / 隔离 / 公开面要改成从角色表推导或由宿主声明。
3. **不写 FSD 的启发式规则**：`insignificant-slice`、`excessive-slicing`、复数一致那些仍归 steiger。
4. 我们**没有** `--fix`（DESIGN 里记着 fixer × 棘轮的冲突，未解）与 `--watch`。

> 结论：**"用我们 = 引擎"而不是"用我们 = 接受三根拓扑"**。这一步做完，FSD 与"其他前端"都进得来，
> 而且不必重做 steiger。

## Comments

- 2026-09-23 成文：来自"成熟工具组合 → FSD 组合 → steiger 的边界 → 能否实现 FSD"这一串讨论。
  所有下载量为该日 npm last-week 数据；steiger 的行为、我们的 FSD 配方、`enable` 阻塞点、
  `entry: []` 的角色歧义均为**本地实测**。
- 待办：**结构声明化**（§8）—— `enable` 并集 + `disable` 减法已落地，§3.3 的 FSD 配方现在开箱可用。
