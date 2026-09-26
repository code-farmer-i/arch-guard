import { globToRegExp } from '../../../engine/util.js'
import type { Finding, Rule, RuleContext } from '../../../engine/types.js'

import { finding } from './structure-util.js'

interface TestHome {
  name: string
  glob: string
  imports?: 'internal' | 'public'
  mustImport?: string[]
}

const homesOf = (ctx: RuleContext): TestHome[] =>
  (ctx.config.adapters.metrics as { tests?: { homes?: TestHome[] } } | undefined)?.tests?.homes ??
  []

/**
 * M10 测试落点契约（R-112）。
 *
 * 三条判据都落在**已有事实 + 依赖图**上（零新事实）：
 *   ① `imports: 'public'` 的层（e2e）只许引**公开面 / 应用入口** —— 否则"重构就红，而门禁不先说话"；
 *   ② `mustImport` 的层必须真的引用到声明的契约产物 —— 否则契约漂移没人发现；
 *   ③ 声明的落点一个文件都没匹配到 → 点名（声明了却没建目录，等于这条纪律没在跑）。
 *
 * 边界（宁少报不误伤）：同层内部的 import（e2e 引 e2e 的 helper）放行；目标是测试角色（test-utils）放行；
 * `mustImport` 的 glob **零命中**放过（那是"还没生成"，不是"没对账"）；`imports: 'internal'`（默认）不做①。
 */
export const testHomeContract: Rule = {
  id: 'M10',
  domain: 'metrics',
  level: 'L3',
  severity: 'error',
  title: '测试落点契约',
  hint: '每层测试声明"许从哪进 / 要对账什么"：e2e 只经公开面，契约测试要真的引用生成的契约',
  requires: ['metrics.tests'],
  run: (ctx) => {
    const homes = homesOf(ctx)
    if (homes.length === 0) return []
    const entryRoles = new Set(
      ctx.config.roles.filter((role) => role.entry === true).map((role) => role.id),
    )
    const entries = new Set(ctx.config.entries ?? [])
    const byRel = new Map(ctx.records.map((record) => [record.rel, record]))
    /** 公开面 = `entry: true` 的角色命中 ∪ `config.entries`（应用入口常常只是 slot，没标 entry） */
    const isPublic = (rel: string): boolean =>
      entries.has(rel) || entryRoles.has(byRel.get(rel)?.role ?? '')
    const out: Finding[] = []
    for (const home of homes) {
      const matcher = globToRegExp(home.glob)
      const files = ctx.files.filter((rel) => matcher.test(rel))
      if (files.length === 0) {
        out.push(
          finding(
            'M10',
            home.glob,
            1,
            `测试落点 ${home.name} 声明的 ${home.glob} 一个文件都没匹配到：这条纪律没在跑`,
            '建目录 / 改 glob / 删掉这条声明（别让声明空转）',
          ),
        )
        continue
      }
      const inside = (rel: string): boolean => matcher.test(rel)
      if (home.imports === 'public') {
        for (const file of files) {
          for (const target of ctx.graph.edges.get(file) ?? []) {
            if (inside(target)) continue // 同层内部（e2e 的 helper / fixture）
            if (byRel.get(target)?.role === 'test') continue // 测试工具
            if (isPublic(target)) continue
            out.push(
              finding(
                'M10',
                file,
                1,
                `${home.name} 只许经公开面 / 应用入口，却直接引了 ${target}`,
                `${home.name} 引内部实现会让重构变成改测试；从公开面（entry）或应用入口进`,
              ),
            )
          }
        }
      }
      if (home.mustImport && home.mustImport.length > 0) {
        const targets = home.mustImport.map(globToRegExp)
        // 声明的产物还不存在 → 放过（"还没生成" ≠ "没对账"）
        if (ctx.files.some((rel) => targets.some((pattern) => pattern.test(rel)))) {
          const hit = files.some((file) =>
            [...(ctx.graph.edges.get(file) ?? [])].some((target) =>
              targets.some((pattern) => pattern.test(target)),
            ),
          )
          if (!hit) {
            out.push(
              finding(
                'M10',
                home.glob,
                1,
                `${home.name} 没有引用声明的契约产物（${home.mustImport.join(' / ')}）：契约漂移没人发现`,
                `补一个对账测试：引 ${home.mustImport.join(' / ')} 断言契约`,
              ),
            )
          }
        }
      }
    }
    return out
  },
}
