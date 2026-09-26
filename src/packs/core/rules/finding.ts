import type { Finding } from '../../../engine/types.js'

/**
 * **发现项构造器 —— 全仓唯一实现**（曾经有 **9 份**：`structure-util` / `design-shared` 各一份**导出**的，
 * 外加 `structure` / `copy` / `deps-adapters` / `hygiene-context` / `deps` / `metrics` / `structure-graph`
 * 各一份**本地**的）。
 *
 * 收敛的触发点是"给发现项加列号"：位置要一路传到每条规则的每一处 `finding(...)`，
 * 九份实现意味着九处都得改、且迟早漂移 —— 正是本仓最防的那类"同一事实多处实现"。
 * `tests/process.test.mjs` 里有条冻结测试：全仓只许有这一个定义（再退化就红）。
 *
 * **位置可以是数字，也可以是事实对象**：传事实对象时若有 `column`，报告与 `--format=github`
 * 注解会渲染成 `file:line:col`（老的"只传行号"写法照旧可用，规则可以逐族迁移）。
 */
export type FindingPosition = number | { line: number; column?: number }

export const finding = (
  rule: string,
  file: string,
  line: FindingPosition,
  text: string,
  hint?: string,
  /** 全局发现项（不挂在某个文件的具体行上，如"声明的落点不存在"） */
  global = false,
): Finding => {
  const position = typeof line === 'number' ? { line } : line
  return {
    rule,
    file,
    line: position.line,
    ...(position.column !== undefined ? { column: position.column } : {}),
    text,
    ...(hint ? { hint } : {}),
    ...(global ? { global: true } : {}),
  }
}
