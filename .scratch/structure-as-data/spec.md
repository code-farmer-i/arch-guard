# 结构声明化（structure as data）

Status: done

## 背景与问题

现在 S 域的结构判据是**内置范式**：三根拓扑写死在 `canonical()` 里，域隔离/层序从 `layout.modules` / `layout.shared` 推导
（见 `rootsOf()`），库/FSD/自研分层只能用"置空根"这种方式让规则**空转**，而不是表达自己的规范。

后果有三条：

1. **换范式要改代码**：想支持 FSD 的"同层切片不许互引""切片必须有公开面"，只能新写专属规则（≈ 重做半个 steiger）。
2. **角色表能匹配路径、但捕获被丢掉**：`scan.ts` 只保留固定名 `domain`，`pattern: 'src/pages/{slice}/ui/**'` 里的
   `{slice}` 对规则不可见 → 写不出任何"按组"的判据。
3. **`config.layers` 之类的死配置**说明过：没有消费者的声明就是陷阱。声明化必须**每条声明都有规则读**。

参照系（[docs/ALTERNATIVES.md](../../docs/ALTERNATIVES.md) §8）：ArchUnit / import-linter / go-arch-lint / Nx tags
都是"声明 组映射 + 组间关系 + 层序 + 公开面"，我们缺的正是这一层抽象。

## 目标

- 让宿主用**纯数据**声明结构关系：层序、组隔离、公开面。
- 让规则从声明推导，**引擎不出现任何具体方法论的名字**（不许有 `fsd` / `atoms` 之类字面量）。
- 让 record 携带**任意捕获**（`{slice}` / `{segment}` …），并派生"组"身份。
- 用**同一份引擎**表达三种规范，各自夹具通过，切换声明不改一行引擎代码。

## 非目标

- ~~不内置 FSD / Atomic Design 预设~~ **反转并已实现**（见 Comments）：预设层本来就是**规范的家**（`canonical()` 也是规范），
  让每个宿主手抄 38 行角色表才是重复劳动。引擎的"零方法论字面量"由 P2/P3 自检保证，所以内置预设不污染引擎。
- **不做目录枚举**：原计划补"目录事实"来检测空切片/缺 `index.ts`。设计后发现不需要 ——
  **组由文件派生**（没有文件的目录不构成组），"组缺入口"用文件集即可判定。少一处引擎改动。
- ~~不迁移 `canonical()` 到通用规则~~ **已迁移**（见 Comments）：应用范式声明 `structure: { order: true }`，
  S21 接管层序，原先 shared 专属的 S07 删除 —— 一套机制管到底。域与装配层的**关系**仍归 S04–S09/S14（声明表达不了）。
- 不做规范的**不可判定部分**（L5）："这个 feature 必须是一个用户动作""这个组件是 molecule 还是 organism"判不了，
  任何引擎都判不了。

## 设计

### 声明形态（Config / Preset）

```ts
interface StructureSpec {
  /** 层序单向：只许依赖层号 ≤ 自己的文件（S21）。应用范式靠 S04–S09/S07，不声明 */
  order?: boolean
  /** 组隔离：同组维度的不同组之间不许互相引用（S22）。值是**组维度名**（捕获名） */
  isolate?: string[]
  /** 公开面（S23）：这些组维度必须有入口；组外不许直接引用组内非入口文件 */
  publicApi?: string[]
}
```

三个字段都**由规则消费**，不存在"声明了没人读"的情况。多个预设/`overrides` 之间**加法合并**（布尔取或、数组取并集）。

### 组身份从哪来

角色描述符上声明 `group`（捕获名）与 `entry`（是否该组的公开面）：

```ts
{ id: 'pages:ui',    pattern: 'src/pages/{slice}/ui/**',       layer: 5, group: 'slice' }
{ id: 'pages:index', pattern: 'src/pages/{slice}/index.{ts,tsx}', layer: 5, group: 'slice', entry: true }
```

record 上派生三个字段：`captures`（全部捕获）、`group`（组值，如 `crews`）、`groupName`（捕获名，如 `slice`）。

### 三条规则（方法无关）

| 规则             | 判据                                                                           | 声明                  |
| ---------------- | ------------------------------------------------------------------------------ | --------------------- |
| **S21 层序单向** | 边 A→B 且 `B.layer > A.layer`                                                  | `structure.order`     |
| **S22 组隔离**   | 边 A→B，两边 `groupName ∈ isolate` 且同名、`layer` 相同、`group` 不同          | `structure.isolate`   |
| **S23 公开面**   | ① 某组的文件里没有任何 `entry` 角色 → 报该组；② 边从组外 → 组内非 `entry` 文件 | `structure.publicApi` |

哨兵层（`test` = 99）跳过。跨层引用不归 S22 管（归 S21 / 应用专属规则），避免一条边两条规则各报一遍。

### 角色表（FSD 示例，宿主侧）

```js
roles: [
  { id: 'pages:ui',    pattern: 'src/pages/{slice}/ui/**',        layer: 5, group: 'slice' },
  { id: 'pages:model', pattern: 'src/pages/{slice}/model/**',     layer: 5, group: 'slice' },
  { id: 'pages:index', pattern: 'src/pages/{slice}/index.{ts,tsx}', layer: 5, group: 'slice', entry: true },
  … features / widgets / entities 同形；app、shared 无组（直接是片段）…
],
structure: { order: true, isolate: ['slice'], publicApi: ['slice'] },
```

## 验收标准

1. **夹具**：新增 `structure-isolate`、`structure-public-api` 两个夹具，各含"违规必到 → 必报"与"合规组 → 不报"两类文件，
   `expect.json` 用 `exact: true`；`node es/cli.js --self-test` 输出 `夹具回归通过：25/25`。
2. **规则覆盖守卫**：`夹具覆盖了全部已实现规则（防「加了规则没加夹具」）` 通过（S22/S23 出现在夹具期望里）。
3. **同一引擎三种声明**：
   - FSD：`structure-isolate` 夹具（组维度 `slice`）通过；
   - 三根：现有 `graph` / `violations` / `clean` 夹具**行为不变**（`canonical()` 不声明 structure）；
   - Atomic Design：在单测里用 `atoms/molecules/organisms` 三层声明跑一次 `order`，违规必报（证明换范式不改引擎）。
4. **不回归**：`pnpm check` 退出 0（build → typecheck → lint → format → 全部测试 → 覆盖率 → 夹具 → 本体自包含 → 示例 → 狗粮）。
5. **声明都有消费者**：`StructureSpec` 的三个字段各被至少一条规则读取（S21/S22/S23 各一），
   `grep structure src/packs` 能对上。

## 边界与取舍

- **误报风险**：S22 只在两边都有组且同层时判 —— 跨层与"一边无组"都不管，宁可少报不误报（门禁铁律）。
- **组名的层级**：`group` 是**单维**（一个角色只声明一个组维度）。`pages/crews/ui` 与 `pages/crews/model` 同组 ✓；
  若某规范需要"组中组"（如 FSD 的分组切片 `features/auth/login`），本期不支持 —— 需要多维组，留作后续。
- **被否方案**：给域开第二个公开面 `index.ts`（原 R1 选项 a）—— 已否，深模块会变成两个出口（PARADIGM §6.3）。
- **被否方案**：内置 `fsd()` 预设 —— 见非目标。

## Comments

- 2026-09-23 立项：来自"能不能实现一套兼容所有规范的引擎"的讨论。结论：能做，形状与 ArchUnit / import-linter 一致；
  硬边界是只能兼容规范的 L1–L3 部分。
- 2026-09-23 设计收敛：原计划的"目录事实"缺口被设计消解（组由文件派生）；`canonical()` 暂不迁移到通用规则（避免重复报）。
- 2026-09-23 实现完成：`FileRecord.captures/group/groupName`、`RoleDescriptor.group/entry`、`StructureSpec`（`order`/`isolate`/`publicApi`）、
  规则 S21（门控改声明）+ S22 + S23（抽到 `rules/structure-declared.ts`）、夹具 `structure-isolate` 与 `structure-public-api`（**25/25** 通过）。
  验收标准 1–5 全部达成；`--fix`/`--watch` 列为本期非目标。
- 2026-09-23 决策反转：**内置 `fsd()` 预设**（原非目标是错的）。理由：预设是规范的家，规则仍是通用的；宿主从"抄 38 行"变成"写一行"。
- 2026-09-23 收尾：`canonical()` 也声明 `structure: { order: true }`，**S07 删除**（规则 56 → 55），
  `__fixtures__/graph` 的两条 S07 期望改为 S21。迁移顺带补上原先没人管的 `shared → modules`、`modules → app` 向上依赖。
  注意：宿主基线里若有 S07 条目，会作为「过期条目」被棘轮提示删除（可见，不静默）。
