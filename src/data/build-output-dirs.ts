/**
 * **构建产物 / 依赖目录名册（纯数据）**。
 *
 * 这是"没配 `ignore` 时的兜底"：`walk()` 见到这些目录名直接不进（不枚举、不解析、不进图）。
 * 它是**数据**而不是散在引擎里的常量，理由与本仓其它数据表一致 —— 名单是会过期的知识，应当可评审、可扩展、
 * 不带逻辑；引擎只负责用它。
 *
 * 与另外两份"边界"的分工（**边界只有 `arch.config.mjs` 一处真相**）：
 *   - `config.ignore`：宿主显式声明的项目边界（**提交在仓库里但不属于源码树**的树，如 `__fixtures__/`、
 *     `examples/`、`.scratch/`）—— 这份名单 `.gitignore` 永远给不出来，因为它们是**被提交**的；
 *   - `.gitignore`：VCS 的关注点（`*.log`、`.DS_Store`、`*.tgz`…），与"要不要判契约"无关，**故意不读**；
 *   - 本表：与项目无关的通用产物目录（`node_modules`、`dist`、`.next`…）—— 覆盖"宿主忘了写 ignore"的情况。
 *
 * 为什么不算进"第三处真相"：前两份是**声明**（可不同），本表是**兜底默认**，且只在没有显式声明时生效。
 */
export const buildOutputDirs: string[] = [
  // 依赖
  'node_modules',
  'bower_components',
  '.pnpm-store',
  '.yarn',
  // VCS / 工具
  '.git',
  '.turbo',
  '.arch-guard-cache',
  // 通用产物
  'dist',
  'build',
  'out',
  'coverage',
  // 各框架的产物目录（宿主常忘在 ignore 里写）
  '.next',
  '.nuxt',
  '.output',
  '.svelte-kit',
  '.angular',
  '.parcel-cache',
  '.vite',
  '.cache',
]
