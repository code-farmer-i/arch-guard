/**
 * **「退路」文件名标记**：重构之后留下的旧实现（`CrewsPage.old.tsx` / `useCrewsLegacy.ts`）。
 *
 * 为什么是数据表：这份词汇是**项目口味**（有的团队写 `.old`、有的写 `_bak`），引擎里不写死；
 * 规则只负责"整段命中"的判定（见 `packs/core/rules/hygiene-retired.ts`）。
 *
 * 注意**不认目录名**：`src/legacy/**` 是迁移期的合法容器（`addRoles` 的典型用法），
 * 判它等于把迁移工具本身判成违规。
 */
export const RETIRED_MARKERS: string[] = [
  'old',
  'legacy',
  'deprecated',
  'backup',
  'bak',
  'orig',
  'copy',
  'tmp',
  'wip',
  'unused',
  'disabled',
  'obsolete',
]
