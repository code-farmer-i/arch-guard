import type { Rule } from '../../../engine/types.js'

/**
 * S24 契约扫描域不得为空：`include` 非空、却一个源码文件都没匹配到 → error。
 *
 * 为什么必须是红线：`include` / `srcRoot` / 预设 `layout` 打错一个字母（或新仓库还没建 `src/`），
 * 就会「域内 0 个文件」—— 所有逐文件规则与角色判定**一条都没跑**，报告却显示「✔ 通过」。
 * 这正是 PARADIGM §11 说的「0 个文件 → 通过 是假绿，比报错危险」，原先只有「认不出的元框架」那一轴被守住。
 *
 * 判据只用 L1（配置里的 glob + 扫描结果计数），不猜任何意图：
 * - `include` 为空 = 不限扫描域（引擎默认）→ **不判**：空仓库是合法形态，由 run 的 notice 自述；
 * - `include` 非空但域内 0 个 ts/css → 报错。域外文件数不能顶替：那是"不判契约"的树，不是被判定的树。
 *
 * 与 S01 的分工：S01 管「文件放错了地方」，S24 管「一个文件都没有」——后者是先决条件。
 */
export const scanScopeNotEmpty: Rule = {
  id: 'S24',
  domain: 'structure',
  level: 'L1',
  severity: 'error',
  title: '契约扫描域不得为空',
  hint: '检查 arch.config.mjs 的 include / overrides.srcRoot 与预设的 layout 是否写错；域内 0 个文件时所有规则都没跑，"通过"是假绿',
  run: (ctx) => {
    if (ctx.config.include.length === 0) return []
    if (ctx.scan.records.length > 0) return []
    return [
      {
        rule: 'S24',
        // 发现项无具体文件可归属，用扫描域本身当"文件"（与 M06 用产物路径同一约定）
        file: ctx.config.include[0] ?? 'arch.config.mjs',
        line: 1,
        text: `契约扫描域内 0 个源码文件（include: ${ctx.config.include.join(', ')}）—— 本次没有任何文件被判定`,
        hint: 'glob 写错？源码不在 src/ 下？改 include / srcRoot / layout，别把"通过"当成"没问题"',
        // 全局谓词：不可归属到某个文件，`--scope=changed` 下默认仍然失败（不许静默丢弃）
        global: true,
      },
    ]
  },
}
