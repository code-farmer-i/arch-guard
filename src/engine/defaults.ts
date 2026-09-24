import type { NamingRules, Thresholds } from './types.js'

/**
 * 阈值与命名契约的**唯一默认值**。
 *
 * 为什么单独放一个文件：这些数字原先在 `config.ts`（引擎兜底）、`canonical()`、`library()`
 * 里各写了一份 —— 改一处，另外两处静默漂移，正是本仓「真相唯一」公理要消灭的形态（docs/DESIGN.md §7.3）。
 * 现在预设与引擎兜底都从这里取，谁都不许再抄一遍数字。
 *
 * 语义不变：**默认值仍然可以被预设与 `overrides.thresholds` 逐键覆盖**（后者胜）。
 */
export const DEFAULT_THRESHOLDS: Thresholds = {
  fileLines: 500,
  viewLines: 500,
  functionLines: 150,
  exportsPerFile: 6,
  componentsPerFile: 3,
}

export const DEFAULT_NAMING: NamingRules = {
  hookPrefix: 'use',
  viewSuffix: 'Page',
}
