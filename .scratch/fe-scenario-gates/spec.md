# 三个前端场景的门禁（取数落点 / 页面懒加载 / 退路残留）

Status: done

## 场景（写不出这一节的需求先不做）

- **换数据层时**：页面里直接 `useQuery`、域里直接 `fetch('/api/x')` —— 换方案要翻遍页面，
  契约类型散在十几个域，写测试必须 mock 网络。**现在：不报（已补）**。
- **上生产时**：路由表静态 `import OrdersPage from './views/OrdersPage'` —— 所有页面随主包下载，
  首屏 1.2MB，第一个月没人发现。**现在：不报（已补）**。
- **长期演进时**：重构后 `CrewsPage.old.tsx` / `useCrewsLegacy.ts` 留在 `views/` —— 没人敢删，
  新人抄了旧的那一份，两套实现行为不一致。**现在：不报（已补）**。

## 目标

- 页面/域里取数与直连后端，在声明的落点之外一律拦住（测试文件豁免）。
- 域入口对页面的 import 必须是懒加载；组件之间的引用不管。
- 文件名带"旧实现整段标记"的文件报出来，子串与目录名不误伤。

## 非目标

- 不管 SSR / 库的公开面契约 / monorepo 跨包（这次只做前端应用）。
- 不判"这段代码该不该抽 hook"（L5）。
- 不查埋点 SDK、localStorage、env 读取的落点（同族场景，但这次没选）。

## 验收标准

- `--self-test` 53/53：`fetch-locations`（页面取数 + 域内直连后端各一条，hooks/ · shared/api/ · 测试文件零命中）、
  `lazy-views`（只有静态 import 那条）、`retired-code`（`.old` 与 camelCase 各一条，`legacy-support.ts` 零命中）。
- `tests/structure-call-sites.test.mjs`（S36 / S37 分支）与 `tests/hygiene-retired.test.mjs`（H12 边界）全绿。
- 双 Node `pnpm check` EXIT=0；规则 71 → 74，README / DESIGN / CHANGELOG 口径同步。

## 边界与取舍

- **S36 只认调用名**：`fetch` 的接收者、`window.fetch` 的别名写法抓不到；位置参数形态的缓存键
  （`useSWR('key')`）仍不在 v1。**已知会漏**：把取数包在自家 `useApi()` 里而不把 `useApi` 写进
  `fetchApis` 就看不见 —— 声明清单是项目责任。
- **S37 只判域入口那一侧**：页面互相静态引用不报（不是首屏问题）；入口不在契约里时由 S03 报。
- **H12 刻意保守**：标记必须在**末尾整段**（`foo.old.ts` / `useCrewsLegacy.ts`），
  所以 `old-crews.ts` / `legacy-support.ts` / `threshold.ts` 都不报 —— 宁可漏，不可误伤。
  真有正当的"旧环境兜底"文件，用规则级 `exceptions` 写清理由。
- **被否方案**：把"取数落点"做成默认约定（不声明也猜 `modules/*/hooks/**`）—— 各项目布局不同，
  猜出来的落点会把正常页面全报红（与"没声明就明列停用"的纪律相反）。

## Comments

- 2026-09-24 需求对话按「场景 → 决定做不做 → 才谈判据」走（见 `docs/agents/scenario-first.md`）：
  从 15 条候选场景里选了这三条（其余：埋点落点 / 状态纪律 / 权限散落 / 上帝域 / 迁移单向性 / 组合根等，
  没选不是不重要，是这次先做最疼且误伤最小的三条）。
