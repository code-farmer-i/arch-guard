# include 扫描域：契约域之外的文件不参与判定

Status: done

## 背景与问题

`scanProject()` 从配置根全树遍历，**每个** ts/css 文件都必须命中角色表，否则进 `missing`、由 S01 报「文件不在目录契约内」。于是：

- 任何非源码位置的 ts/css 都是假报：`vite.config.ts`、`eslint.config.mjs`、`e2e/`、`scripts/`、生成代码、vendored 代码。实测把一个 2 万文件的生成代码目录放进项目 → **2 万条 S01**，另白解析 490ms。
- 宿主只能靠 `ignore` 逐个枚举路径；`library()` 预设那 11 条 ignore 就是被这件事逼出来的（`src/presets/library.ts`）。
- 与「封闭枚举、未登记即红」不冲突：缺的是「**哪片树属于契约**」的声明，而不是放宽任何判定。

## 目标

- 新增 `include`（配置根相对的 glob 列表）：**只有命中 include 的 ts/css 参与角色判定与逐文件规则**。
- 域外文件仍**照常解析并进依赖图**（角色记为 `(outside)`）：import 边与「测试是独立可达根」都靠 facts，少了它们，只被域外测试引用的 src 文件会被误判成孤儿（S15）。这条是实测踩出来的：第一版只把域外文件留在文件集、不解析，`tests/thing.test.ts` 就接不上 `src/shared/lib/thing.ts`。
- `canonical()` / `library()` 默认 `include = [<srcRoot>/**]`；`overrides.include` 可覆盖；空数组 = 不限制（引擎默认，向后兼容）。
- 报告自述扫描域与域外文件数：改默认是**行为变更**，必须看得见。
- `M08`（该有测试的文件）改从完整文件集找测试文件：测试常放在契约域之外（`tests/`），它们没有角色、不进 records，但「有没有测试」必须看得见。

## 非目标

- 不改 `ignore` / `exempt` 语义（它们是「命中契约之后」的豁免通道）。
- 不做 monorepo 多根（另开）。
- 不缩 `walk()`：目录遍历仍走全树（只 stat、不解析），避免用 glob 反推目录造成漏扫。
- **不省域外文件的解析**：域外文件照常抽 facts（否则图断链 → 假孤儿，见上）。要做「只解析被契约域引用到的域外文件」得先有依赖图工作队列，另开一张票。
- 不把测试目录塞进 include：测试不是「要落位的契约文件」，塞进去等于让 `tests/helpers/*.ts` 之类再次撞 S01。

## 验收标准

- 夹具 `include-scope`（`canonical()` 默认）：域外的 `vite.config.ts`（写成 `export *` 形态）与 `scripts/gen.ts` → **不报** S01 / S11；`tests/thing.test.ts` 引用 `src/shared/lib/thing.ts` → 后者**不报** S15（测试根仍在文件集里）。`expect.json` 用 `exact: true` 锁零发现项。
- 夹具 `include-custom`：`overrides.include: ['src/**','scripts/**']` → `scripts/gen.ts` 重新参与判定并报 S01；域外 `vite.config.ts` 仍不报。
- 单测：`scanProject()` 在 `include` 下不产出 `missing`，且域外文件仍在 `files` 里、被记进 `outside`。
- 报告摘要出现扫描域与域外文件数。
- `pnpm guard:self` / `pnpm guard:sample` / 自检 P1–P3 仍绿；测试无新增失败。

## 边界与取舍

- 域外文件仍在 `files` 里且仍被解析 → 解析成本不降（省下的是**假报**与域内文件的重判代价）。要一并省掉解析见「非目标」。
- `include` 与角色表不是两处真相：`include` 声明「哪片树属于契约」，角色表声明「契约内怎么落位」；`include` 只能比角色表**粗**。
- 被否：把默认路径塞进 `ignore` —— 路径无穷，等于没修。
- 被否：让 `include` 同时裁剪 `files` 与 facts —— 会断掉跨界引用与测试根，制造假孤儿（实测）。
- 代价：默认收窄后，以前报的域外 S01 会消失。因此报告必须自述，CHANGELOG 按行为变更写。

## Comments

- 2026-09-23 提出：来自「非源码目录全量 S01 + 白解析」的实测（2 万生成文件 → 2 万条 error）。
- 2026-09-23 落地：`include` 进 Config/Preset，`canonical()` / `library()` 默认 `src/**`；新增 `include-scope` / `include-custom` 两个夹具；`M08` 改从完整文件集找测试。实测 2 万域外生成文件：**20000 条 error → 0**，仓库转绿。
- 2026-09-23 修正：第一版让域外文件「不解析、只留在文件集」，结果 `tests/` 里的测试接不上 src，`src/shared/lib/thing.ts` 被误报 S15 —— 夹具当场抓住。改为域外文件照常解析（角色 `(outside)`），只在角色判定上排除。
