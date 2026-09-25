import { resolveSpecifier } from '../../../engine/graph.js'
import type { Finding, Rule } from '../../../engine/types.js'
import { globToRegExp } from '../../../engine/util.js'

import { finding } from './structure-util.js'

/**
 * 声明驱动的**边界**规则两条：
 *
 * - **S39 组耦合上限**：一个组被多少个**其它组**依赖（fan-in）/ 依赖了多少个其它组（fan-out）超限即报。
 *   与 S34（文件级度数）的分工：S34 找神模块，这条找"上帝域 / 什么都碰的域"。
 * - **S40 迁移中的目录只出不进**：项目声明哪些路径在迁移中，别处引用它们就报（它们自己引用别处是目的）。
 *
 * 两条都由 `structure.*` 声明驱动：**没声明不判**，阈值与路径全在宿主手里。
 */

/** 组值：按声明维度取捕获值；取不到（角色表没这个捕获）就跳过 —— 宁少报不误报 */
function groupValuesOf(
  ctx: { records: { rel: string; layer: number; captures: Record<string, string> }[] },
  dimension: string,
): Map<string, string> {
  const groups = new Map<string, string>()
  for (const record of ctx.records) {
    // 测试角色（layer ≥ 90）天然引用各处，算进去只会让每个组都超限
    if (record.layer >= 90) continue
    const value = record.captures[dimension]
    if (!value) continue
    groups.set(record.rel, value)
  }
  return groups
}

const summarise = (values: Set<string>): string => {
  const sorted = [...values].sort()
  return sorted.length <= 5
    ? sorted.join('、')
    : `${sorted.slice(0, 5).join('、')}…（共 ${sorted.length}）`
}

/* ---------------- S39 组耦合上限 ---------------- */

export const groupCouplingLimits: Rule = {
  id: 'S39',
  domain: 'structure',
  level: 'L2',
  severity: 'error',
  title: '组耦合上限',
  hint: '一个组被太多组依赖（上帝域）或依赖太多组（什么都碰）：把共享部分下沉，或按调用方把它切开',
  run: (ctx) => {
    const specs = ctx.config.structure.couplingLimits ?? []
    if (specs.length === 0) return []
    const out: Finding[] = []
    for (const spec of specs) {
      const groups = groupValuesOf(ctx, spec.dimension)
      if (groups.size === 0) continue
      /** 方向必须分开记：fan-in 与 fan-out 是两组不同的对端，混在一起会互相污染计数 */
      const outPartners = new Map<string, Set<string>>()
      const inPartners = new Map<string, Set<string>>()
      const outPerFile = new Map<string, { group: string; partner: Set<string> }>()
      const inPerFile = new Map<string, { group: string; partner: Set<string> }>()
      const note = (
        table: Map<string, Set<string>>,
        perFile: Map<string, { group: string; partner: Set<string> }>,
        rel: string,
        group: string,
        other: string,
      ): void => {
        const set = table.get(group) ?? new Set<string>()
        set.add(other)
        table.set(group, set)
        const seen = perFile.get(rel) ?? { group, partner: new Set<string>() }
        seen.partner.add(other)
        perFile.set(rel, seen)
      }
      for (const [rel, from] of groups) {
        for (const target of ctx.graph.edges.get(rel) ?? []) {
          const to = groups.get(target)
          if (!to || to === from) continue
          note(outPartners, outPerFile, rel, from, to) // fan-out：这个组依赖了 to
          note(inPartners, inPerFile, target, to, from) // fan-in：to 被这个组依赖
        }
      }
      /** 锚点：组内参与度最高的文件（同分取字典序最小，保证报告稳定）；不参与判定 */
      const anchorOf = (
        perFile: Map<string, { group: string; partner: Set<string> }>,
        group: string,
      ): string => {
        let best = { rel: '', count: -1 }
        for (const [rel, seen] of perFile) {
          if (seen.group !== group) continue
          if (
            seen.partner.size > best.count ||
            (seen.partner.size === best.count && rel < best.rel)
          ) {
            best = { rel, count: seen.partner.size }
          }
        }
        return best.rel
      }
      const check = (
        direction: 'in' | 'out',
        table: Map<string, Set<string>>,
        perFile: Map<string, { group: string; partner: Set<string> }>,
        max: number,
      ): void => {
        for (const [group, others] of [...table].sort(([a], [b]) => a.localeCompare(b))) {
          if (others.size <= max) continue
          const anchor = anchorOf(perFile, group)
          if (!anchor) continue
          out.push(
            finding(
              'S39',
              anchor,
              1,
              direction === 'in'
                ? `组「${group}」被 ${others.size} 个组依赖（上限 ${max}）：${summarise(others)}`
                : `组「${group}」依赖了 ${others.size} 个组（上限 ${max}）：${summarise(others)}`,
              direction === 'in'
                ? '被依赖过多 = 改一处动全组：把共享部分下沉到更低的层，或按调用方把它切开'
                : '依赖过多 = 职责不清：把不属于它的那部分搬出去，别让它碰每个组',
            ),
          )
        }
      }
      if (spec.maxFanIn !== undefined) check('in', inPartners, inPerFile, spec.maxFanIn)
      if (spec.maxFanOut !== undefined) check('out', outPartners, outPerFile, spec.maxFanOut)
    }
    return out
  },
}

/* ---------------- S40 迁移中的目录只出不进 ---------------- */

export const migratingBoundary: Rule = {
  id: 'S40',
  domain: 'structure',
  level: 'L2',
  severity: 'error',
  title: '迁移中的目录只出不进',
  hint: '迁移中的代码可以引用别人，但别人不许再引用它 —— 新代码请用新实现，否则它永远迁不完',
  run: (ctx) => {
    const globs = ctx.config.structure.migrating ?? []
    if (globs.length === 0) return []
    const patterns = globs.map((glob) => globToRegExp(glob))
    const inMigration = (rel: string): boolean => patterns.some((pattern) => pattern.test(rel))
    if (!ctx.files.some(inMigration)) return [] // 声明没命中任何文件：可能刚好迁完了，不报
    const files = new Set(ctx.files)
    const out: Finding[] = []
    for (const record of ctx.records) {
      if (inMigration(record.rel)) continue // 只出不进：迁移中的文件引用谁都合法
      const facts = ctx.facts.get(record.rel)
      if (!facts) continue
      for (const imported of facts.imports) {
        const target = resolveSpecifier(imported.spec, record.rel, ctx.config, files)
        if (!target || !inMigration(target)) continue
        out.push(
          finding(
            'S40',
            record.rel,
            imported.line,
            `引用了迁移中的文件：${target}`,
            '改成新实现；确实必须先用旧的，就把它从迁移声明里拿掉（别让迁移边界失去意义）',
          ),
        )
      }
    }
    return out
  },
}

export const structureBoundaryRules: Rule[] = [groupCouplingLimits, migratingBoundary]
