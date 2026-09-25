# 幽灵依赖与声明未用（C1 / C2）

Status: done

## 场景（对应 REQUIREMENTS.md 的 R-17）

- **换机器就崩时**：某文件 `import leftPad from 'left-pad'`，而 `package.json` 里没有它 ——
  本地能跑是因为别的包把它间接装进来了。CI / 新同事克隆下来直接炸。**修前：不报**（委派给 eslint-plugin-import，
  要装插件 + 写 resolver 配置，本仓就没装）。
- **依赖越滚越大时**：`dependencies` 里躺着 `lodash`，全项目没人 import —— 没人敢删，
  审计面、升级面、体积都在变大。**修前：不报**（委派给 knip / depcheck，要单独装 + 写 entry 配置）。

## 目标

- **P03 幽灵依赖**（error）：import 了但没在 `package.json` 任何 dependencies 段声明 → 报在**引用它的那一行**。
- **P08 声明未用**（warn，**声明才判**）：写进 `dependencies` 却全项目零引用 → 报在 `package.json` 上；`deps({ unusedDeps: true })` 才判（默认关的理由见「边界与取舍」）。
- 两条都由 `deps()` 域预设默认启用（该预设本来就是"依赖纪律"的家）；没有 `package.json` 时整体跳过。
- 只报 `dependencies`：`devDependencies` / `peerDependencies` 可能只给工具链或宿主用，报它们是噪音。

## 非目标

- 不自动删依赖、不自动加声明（门禁只判，不修）。
- 不判"这个依赖该不该用"（那是选型 / review）。
- 不做版本区间、锁文件、审计漏洞那类检查（不在本门禁范围）。

## 验收标准

- 夹具 `phantom-deps`：`left-pad` 报（error，锚在 `src/shared/lib/pad.ts`）；已声明的 `dayjs` 与 `node:fs` 不报。
- 夹具 `unused-deps`：`lodash` 报（warn，锚在 `package.json`）；有人用的 `dayjs` 不报。
- 单测：`hasManifest: false` 不报；`phantom` / `unused` 为空不报；P08 是 `global` 发现项。
- 双 Node `pnpm check` EXIT=0；DESIGN §5.4 有 P03（error）/ P08（warn）两行，计数口径同步。

## 边界与取舍

- **P03 锚在引用点、P08 锚在 `package.json`**：前者要能点开就改（改的是 import 或声明），
  后者根本没有"某个文件"可指（是清单层面的问题）—— 用 `global` 发现项，与 P01/P02 一致。
- **P08 默认关**（声明才判）：实现时用本仓夹具验证发现，只按"import 过没有"判会把**自动 JSX 运行时**（`react` 声明了但没人 import）、副作用型依赖与只在构建配置里用的包报成"未使用" ——
  判准需要 entry / 插件知识（knip 靠的就是这个）。按"宁可漏报不可误伤"改成声明才判。
- **与 knip / depcheck 的关系**：不是替代，而是"宿主没装也有覆盖"。装了的话结论一致，两边都报也不算噪音
  （报告里规则号不同，容易分辨）。
- **被否方案**：把 P08 也锚到某个 import 点（没有 import 可锚）；把两条合成一条（严重度与锚点都不同）。

## Comments

- 2026-09-25 委派评审（`docs/DELEGATION-REVIEW.md`）判定这两条"用户配置成本高、事实已现成" → 收回本体（C1 / C2）。
