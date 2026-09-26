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

/**
 * **达到这个层号就算"非业务代码"**（测试 / story）—— 全仓唯一出处（以前是散在 7 个文件里的
 * 19 处 `layer >= TEST_LAYER_MIN`，典型的魔法数字多处）。
 *
 * 与角色表的区别：角色表把 `test` 放在 **99**（那是个具体角色的层号）；这里问的是
 * "这条记录算不算业务文件"的**判据阈值**，所以单列一个常量。
 */
export const TEST_LAYER_MIN = 90

/**
 * **项目边界的默认 ignore**（配置文件、agent 目录 —— 它们既不是源码也不是产物）。
 *
 * 三个范式共用同一份：以前它逐字写在 `canonical()` 与 `library()` 里各一份，
 * 补一条就要改两处（漏一处就是"两个范式的边界不一样"）。
 */
export const DEFAULT_IGNORE = ['arch.config.mjs', 'arch.config.js', '.agents/**']
