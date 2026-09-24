import type { Finding, Rule } from '../../../engine/types.js'

import { bucketsOf, extraDirsOf, finding, unitDirOf } from './structure-util.js'

/**
 * 声明驱动的**组与目录**规则：组完整性（S35）· 保留名目录（S25）· 规模阈值（S26/S27）。
 *
 * 阈值与词表都来自 `structure.*` 声明，规则里没有方法论字面量：
 * 换一份角色表 + 声明，同一组规则就能量别的目录规范。
 * （编号说明：本仓库上游的 S24 是「契约扫描域非空」，所以"组必须有片段"落 **S35**。）
 */

/* ---------------- S35 组必须有片段（不能只有公开面入口） ---------------- */

/**
 * 判据：某个组里**除入口角色外一个文件都没有** → 只有一个空壳入口。
 *
 * 与 S23① 的分工（两条不许互相重复报）：
 *   - 只有 `index.ts` 的切片 → **S35** 报（公开面在，但里面没东西）；
 *   - 只有 `ui/` 没有 `index.ts` 的切片 → **S23①** 报（有内容，但没公开面）。
 *
 * 组维度由 `structure.segmentedGroups` 声明 —— 引擎不认识"切片"这个词。
 */
export const segmentedGroups: Rule = {
  id: 'S35',
  domain: 'structure',
  level: 'L3',
  severity: 'error',
  title: '组必须有片段',
  hint: '只有公开面入口的组等于空壳：把代码拆进片段目录，或把它并回用到它的地方',
  run: (ctx) => {
    const dimensions = new Set(ctx.config.structure.segmentedGroups ?? [])
    if (dimensions.size === 0) return []
    const entryRoles = new Set(
      ctx.config.roles.filter((role) => role.entry === true).map((role) => role.id),
    )
    const groups = new Map<
      string,
      { layer: number; group: string; anchor: string; body: boolean }
    >()
    for (const record of ctx.records) {
      if (record.layer >= 90) continue
      if (!record.groupName || !dimensions.has(record.groupName) || !record.group) continue
      const key = `${record.layer}:${record.groupName}:${record.group}`
      const seen = groups.get(key) ?? {
        layer: record.layer,
        group: record.group,
        anchor: record.rel,
        body: false,
      }
      if (record.rel < seen.anchor) seen.anchor = record.rel
      if (!entryRoles.has(record.role)) seen.body = true
      groups.set(key, seen)
    }
    const out: Finding[] = []
    for (const group of groups.values()) {
      if (group.body) continue
      out.push(
        finding(
          'S35',
          group.anchor,
          1,
          `组「${group.group}」（第 ${group.layer} 层）只有公开面入口，没有任何片段：拆不开的组说明它还不该独立存在`,
        ),
      )
    }
    return out
  },
}

/* ---------------- S25 片段内不许出现保留名目录 ---------------- */

/**
 * 判据：文件路径里**超出角色 pattern 自己那一段**的目录，基名命中 `structure.reservedNames` → 报。
 *
 * 例（声明 `['ui','api','lib','model','config','@x']`）：
 *   - `shared/ui/button/index.ts` → `button` 不是保留名 → 放过；
 *   - `shared/lib/ui/util.ts` → 多余的 `ui` → 报（读的人会把它当成片段）；
 *   - `shared/ui/button/ui/x.ts` → 更深处那个 `ui` → 报。
 *
 * 判据全靠**角色 pattern 的目录部分**：`src/pages/{slice}/ui/**` 消耗三层目录，
 * 所以 `src/pages/crews/ui` 本身不是"多余目录"，`src/pages/crews/ui/lib` 里的 `lib` 才是。
 */
export const reservedFolderNames: Rule = {
  id: 'S25',
  domain: 'structure',
  level: 'L1',
  severity: 'error',
  title: '片段内不许出现保留名目录',
  hint: '保留名（ui / api / lib …）专指片段那一层：嵌套同名目录会让读者分不清自己在哪一层',
  run: (ctx) => {
    const reserved = new Set(ctx.config.structure.reservedNames ?? [])
    if (reserved.size === 0) return []
    const patternOf = new Map(ctx.config.roles.map((role) => [role.id, role.pattern]))
    const violations = new Map<string, string[]>()
    for (const record of ctx.records) {
      if (record.layer >= 90) continue
      const pattern = patternOf.get(record.role)
      if (pattern === undefined) continue
      const extra = extraDirsOf(record.rel, pattern)
      if (extra === null) continue
      for (const dir of extra) {
        const base = dir.slice(dir.lastIndexOf('/') + 1)
        if (!reserved.has(base)) continue
        const list = violations.get(dir) ?? []
        list.push(record.rel)
        violations.set(dir, list)
      }
    }
    const out: Finding[] = []
    for (const [dir, files] of [...violations].sort(([a], [b]) => (a < b ? -1 : 1))) {
      const anchor = [...files].sort()[0] as string
      const base = dir.slice(dir.lastIndexOf('/') + 1)
      out.push(
        finding(
          'S25',
          anchor,
          1,
          `${dir} 是片段内的保留名目录（「${base}」专指片段那一层）：改名，或把它上移到片段根`,
        ),
      )
    }
    return out
  },
}

/* ---------------- S26 组数量上限 ---------------- */

/**
 * 判据：按「层 + 父组桶」分组后，桶内**不同的组**超过 `max` → 报（锚在桶内字典序最小的文件上）。
 *
 * "父组桶"由 `captures` 里**除本维度外**的捕获决定：分组切片
 * （`src/features/{group}/{slice}/ui/**`）的桶就是 `{group}`；未分组的切片同属一个桶。
 * 阈值由宿主声明（社区默认 20）—— 规则里没有数字，大应用调高即可。
 */
export const groupCountLimits: Rule = {
  id: 'S26',
  domain: 'structure',
  level: 'L3',
  severity: 'error',
  title: '组数量上限',
  hint: '同一层里堆太多同类组说明该分组（或该把代码移回用到它的地方）；阈值在 structure.groupCountLimits 里调',
  run: (ctx) => {
    const limits = ctx.config.structure.groupCountLimits ?? []
    if (limits.length === 0) return []
    const out: Finding[] = []
    for (const limit of limits) {
      for (const bucket of bucketsOf(ctx, limit.dimension).values()) {
        if (bucket.names.size <= limit.max) continue
        const where = bucket.bucket === '' ? '' : `（组 ${bucket.bucket}）`
        out.push(
          finding(
            'S26',
            bucket.anchor,
            1,
            `第 ${bucket.layer} 层${where}有 ${bucket.names.size} 个「${limit.dimension}」组，超过上限 ${limit.max}：考虑分组，或把代码移回用到它的层`,
          ),
        )
      }
    }
    return out
  },
}

/* ---------------- S27 目录子项数上限 ---------------- */

/**
 * 判据：角色目录的**一级子项**超过 `max` → 报（锚在该目录内字典序最小的文件上）。
 *
 * 默认数"文件 + 子目录"（社区 linter 的 `shared/lib` 就是这个口径）；
 * `foldersOnly: true` 时只数子目录。宿主可给任意角色 —— 规则里没有 `shared/lib` 这个词。
 */
export const directoryItemLimits: Rule = {
  id: 'S27',
  domain: 'structure',
  level: 'L3',
  severity: 'error',
  title: '目录子项数上限',
  hint: '一个目录里堆太多模块说明该分组了（shared/lib 是最常见的一个）；阈值在 structure.directoryItemLimits 里调',
  run: (ctx) => {
    const limits = ctx.config.structure.directoryItemLimits ?? []
    if (limits.length === 0) return []
    const out: Finding[] = []
    for (const limit of limits) {
      const roleRecords = ctx.records.filter((record) => record.role === limit.role)
      const dir = unitDirOf(ctx.config.roles, limit.role, roleRecords)
      if (dir === null) continue
      const members = ctx.records
        .map((record) => record.rel)
        .filter((rel) => rel.startsWith(`${dir}/`))
        .sort()
      if (members.length === 0) continue
      const children = new Set<string>()
      for (const rel of members) {
        const rest = rel.slice(dir.length + 1)
        const [head, ...tail] = rest.split('/')
        if (head === undefined || head === '') continue
        if (limit.foldersOnly === true && tail.length === 0) continue
        children.add(head)
      }
      if (children.size <= limit.max) continue
      out.push(
        finding(
          'S27',
          members[0] as string,
          1,
          `${dir} 有 ${children.size} 个一级子项，超过上限 ${limit.max}：按用途分子目录，别让一个目录变成杂物间`,
        ),
      )
    }
    return out
  },
}

/* ---------------- S28 组的外部引用下限（死切片） ---------------- */

/**
 * 判据（只数**跨层**的引用，同层引用不计）：
 *   - 引用组数为 0 → 报"没被用到"；
 *   - 少于 `min` → 报（默认 `min: 1` 时就是"只有一个引用者，通常该合并进去"）；
 *   - 例外：唯一引用者来自 `singleFromLayers` 里的层时放过（页面只被装配层引用是正常形态）。
 *
 * `exceptLayers` 整层跳过：页面天然只被路由层引用，查它只会得到一片噪音。
 * 计数单位是**引用组**（层 + 组值），与社区 linter 的 (layer, slice) 口径一致。
 */
export const groupInDegree: Rule = {
  id: 'S28',
  domain: 'structure',
  level: 'L3',
  severity: 'error',
  title: '组的外部引用下限',
  hint: '没人引用的组是死代码；只有一个引用者时通常该把它合并进那一处',
  run: (ctx) => {
    const specs = ctx.config.structure.groupInDegree ?? []
    if (specs.length === 0) return []
    const byRel = new Map(ctx.records.map((record) => [record.rel, record]))
    const entryRoles = new Set(
      ctx.config.roles.filter((role) => role.entry === true).map((role) => role.id),
    )
    const out: Finding[] = []

    for (const spec of specs) {
      const except = new Set(spec.exceptLayers ?? [])
      const singleFrom = new Set(spec.singleFromLayers ?? [])
      const groups = new Map<
        string,
        { layer: number; group: string; anchor: string; bodyAnchor: string | null }
      >()
      for (const record of ctx.records) {
        if (record.layer >= 90) continue
        if (record.groupName !== spec.dimension || !record.group) continue
        if (except.has(record.layer)) continue
        const key = `${record.layer}:${record.group}`
        const seen = groups.get(key) ?? {
          layer: record.layer,
          group: record.group,
          anchor: record.rel,
          bodyAnchor: null,
        }
        if (record.rel < seen.anchor) seen.anchor = record.rel
        if (
          !entryRoles.has(record.role) &&
          (seen.bodyAnchor === null || record.rel < seen.bodyAnchor)
        ) {
          seen.bodyAnchor = record.rel
        }
        groups.set(key, seen)
      }

      // 遍历**图里的所有边**（而不是 records 里的文件）：契约域外的文件（`vite.config.ts`、
      // 未登记路径）照样能引用到组，把它们漏掉会把"其实有人用"报成死代码。
      const referrers = new Map<string, Set<string>>()
      for (const [from, targets] of ctx.graph.edges) {
        const source = byRel.get(from)
        if (source && source.layer >= 90) continue
        for (const target of targets) {
          const to = byRel.get(target)
          if (!to || to.layer >= 90) continue
          if (to.groupName !== spec.dimension || !to.group) continue
          if (except.has(to.layer)) continue
          if (source && source.layer === to.layer) continue
          const key = `${to.layer}:${to.group}`
          if (!referrers.has(key)) referrers.set(key, new Set())
          referrers.get(key)?.add(`${source?.layer ?? 'outside'}:${source?.group ?? ''}`)
        }
      }

      for (const [key, group] of groups) {
        const refs = referrers.get(key) ?? new Set<string>()
        if (refs.size >= spec.min) continue
        if (refs.size === 1 && singleFrom.size > 0) {
          const only = [...refs][0] as string
          const layer = Number(only.slice(0, only.indexOf(':')))
          if (singleFrom.has(layer)) continue
        }
        const anchor = group.bodyAnchor ?? group.anchor
        out.push(
          finding(
            'S28',
            anchor,
            1,
            refs.size === 0
              ? `组「${group.group}」（第 ${group.layer} 层）没有任何外部引用：没被用到的东西就是死代码`
              : `组「${group.group}」（第 ${group.layer} 层）只有 ${refs.size} 个外部引用组，少于下限 ${spec.min}：考虑合并进引用方`,
          ),
        )
      }
    }
    return out
  },
}

export const structureGroupRules: Rule[] = [
  segmentedGroups,
  reservedFolderNames,
  groupCountLimits,
  directoryItemLimits,
  groupInDegree,
]
