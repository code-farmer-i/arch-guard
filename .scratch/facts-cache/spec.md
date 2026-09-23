# facts 持久缓存：没改的文件不再重新解析

Status: done

## 背景与问题

`runGuard` 每轮都对**全部** ts 文件跑 `extractFacts`（解析 + 访问器 + 注释扫描）。实测 3043 个 ts 文件 / 21.5 万行：
`extractFacts` 占 **4.6s / 5.8s（79%）**，而全部规则加起来只有 168ms。
于是「只改了 1 个文件」和「全量重跑」一样贵 —— `--scope=changed` 实测 26k 文件 4.40s vs 4.40s，**一点没省**。

DESIGN §6.8 早就把方案写好了（「facts 按文件缓存（增量），图与全局谓词每轮全量重建」），只是没实现。

## 目标

- 把每个文件的 facts 按**内容哈希**缓存到磁盘；下一轮没变的文件直接读缓存，不解析。
- 键必须**复合且精确**：`文件内容 + rel + role` 决定单文件事实；`FACTS_CACHE_SPEC + typescript 版本` 决定整份缓存是否还成立。
- 失效必须是 fail-safe：内容变了、role 变了、规范版本变了、TS 版本变了 → 重算，绝不给出旧事实。
- 图与全局谓词**每轮照旧全量重建**（这不是缓存的一部分）—— 保证「scope 只过滤报告」的语义不被破坏。
- 跑完自述命中数（不许静默）；`--no-cache` 可关。
- 缓存坏掉/版本不符时：忽略它、全量重算、并说明原因。

## 非目标

- 不缓存图、不缓存规则结果、不做「只解析变更文件」的图裁剪。
- 不做跨机器共享的缓存格式兼容（`spec` 不匹配就整份作废）。
- 不缓存 CSS 解析产物（CSS 处理本来就不贵，实测 read 只占 203ms）。

## 验收标准

- 同一项目连跑两次（第二次不改文件）：第二次 `cache.hits == 文件数`，且发现项完全一致。
- 改一个文件后再跑：该文件 `miss`，**新增的违规必须报出来**（证明失效生效，不是假绿）。
- 改动 `arch.config.mjs` 的角色表（role 变化）→ 受影响文件重算。
- 缓存文件损坏 / `spec` 不匹配 / TS 版本不同 → 全量重算 + notice，发现项与无缓存时一致。
- `--no-cache`：全 miss，结果一致。
- `pnpm check` 全绿；实测热跑耗时不高于冷跑的一半。

## 边界与取舍

- 缓存位置：**有 `node_modules` 就写 `node_modules/.arch-guard-cache/facts.json.gz`**（学 Vite：那里天然被 git 忽略、
  `rm -rf node_modules` 顺手带走，宿主什么都不用配），没有 `node_modules` 时退回项目根 `.arch-guard-cache/`
  （该名字已在 `DEFAULT_SKIP` 与 `.gitignore` 里）。
- 缓存的体积用 gzip 压：实测 3k 文件 14.0MB → 0.7MB。
- 「解析省了、但读文件还得读全部」：内容哈希要算，所以每轮仍要读所有文件（实测 203ms + 28ms），这是刻意的 —— 不看内容就没法知道该不该复用。
- 被否：按 `--scope=changed` 只读变更文件 —— 会漏掉「A 改了影响 B」，正是 stale-cache 假绿。
- 被否：把规则集哈希写进键 —— facts 的产出与规则集无关，写了只会平白让缓存失效。

## Comments

- 2026-09-23 提出：来自实测（extractFacts 占 79%；`--scope=changed` 0 收益）。
- 2026-09-23 落地：`src/engine/facts-cache.ts`，键 = rel + role + 内容 sha1，整份 = spec + TS 版本；
  实测 3043 文件 / 21.5 万行：**5.88s → 1.22s（4.8×）**；26k 小文件仓库 −23%。7 条测试全过。
- 2026-09-23 位置改为 Vite 策略（优先 `node_modules/.arch-guard-cache/`）——宿主不用再往 .gitignore 加规则。
