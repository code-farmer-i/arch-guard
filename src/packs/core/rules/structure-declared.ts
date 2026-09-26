import type { Finding, Rule } from '../../../engine/types.js'

import { finding, unitDirOf } from './structure-util.js'

/**
 * **声明驱动**的结构规则：分层单向、组隔离、公开面（S21–S23）。
 *
 * 这一组不认识任何具体方法论：层号、组、入口全部来自
 * `structure: { order, isolate, publicApi, publicApiUnits }` 与角色描述符上的 `group` / `entry`。
 * 所以同一份引擎能表达三根拓扑、FSD、Atomic Design —— 换范式只改声明，不改这里。
 */

/* ---------------- S21 分层单向（通用：库 / 自定义范式） ---------------- */

/**
 * 只许依赖**层号 ≤ 自己**的文件。
 *
 * 它是 `library({ modules: { data: 1, engine: 2 } })` 里那些数字的**唯一用途** ——
 * 不启用它，层号就只是一份没人读的声明（实测：把数字倒过来，输出一模一样）。
 *
 * 门控是**声明**（`structure.order`），不是猜：应用范式的层序由应用专属规则负责
 * （S07 shared 线性层序 + S04–S09 域/装配层），那套预设不声明 `order`；
 * 库 / FSD / 自研分层声明 `structure: { order: true }`。这样一条边只会被一条规则报。
 *
 * 哨兵层（`test` = 99）不是真实层：测试可以引用任何东西，跳过。
 */
export const layerOrder: Rule = {
  id: 'S21',
  domain: 'structure',
  level: 'L3',
  severity: 'error',
  title: '分层单向',
  hint: '层号越小越底层：只许依赖层号 ≤ 自己的文件；反向依赖说明分层被绕过了',
  run: (ctx) => {
    if (ctx.config.structure.order !== true) return []
    const byRel = new Map(ctx.records.map((record) => [record.rel, record]))
    const out: Finding[] = []
    for (const record of ctx.records) {
      if (record.layer >= 90) continue
      for (const target of ctx.graph.edges.get(record.rel) ?? []) {
        const to = byRel.get(target)
        if (!to || to.layer >= 90) continue
        if (to.layer > record.layer) {
          out.push(
            finding(
              'S21',
              record.rel,
              1,
              `反向依赖：第 ${record.layer} 层的 ${record.rel} 引用了第 ${to.layer} 层的 ${target}`,
            ),
          )
        }
      }
    }
    return out
  },
}

/* ---------------- S22 组隔离（同维度、同层、不同组不许互引） ---------------- */

/**
 * 判据：边 A→B，且
 *   ① 两边的**组维度相同**（都声明了 `group: '<同一个捕获名>'`）—— 维度不同不予比较；
 *   ② **同一层** —— 跨层引用归层序（S21）或应用专属规则，不在这里重复报；
 *   ③ 组值不同。
 *
 * 一条都不满足就放过：门禁宁可少报也不误报。声明 `structure.isolate: ['slice']` 才生效。
 */
/**
 * 官方 `@x` 跨引用公开面（R-105）：`<provider>/@x/<consumer>.{ts,tsx}` ——
 * **只有被指名的那一侧**能引它（`consumer` 捕获 == 调用方的切片名）。
 *
 * 这是 FSD 给"同层切片互引"留的唯一出口：`entities/artist` 要用 `entities/song` 的类型时，
 * 由 song 导出 `song/@x/artist.ts`，artist 只许从那个文件进 —— 连接是**显式**的，
 * 重构时想忽略都难（官方 public-api 页的原话："make the connection impossible to miss"）。
 */
export function crossImportAllowed(
  importer: { captures?: Record<string, string> },
  target: { captures?: Record<string, string> },
): boolean {
  const consumer = target.captures?.consumer
  if (consumer === undefined || consumer === '') return false
  return importer.captures?.slice === consumer
}

export const groupIsolation: Rule = {
  id: 'S22',
  domain: 'structure',
  level: 'L3',
  severity: 'error',
  title: '组隔离',
  hint: '同层不同组不许直连：共享部分提升到公共层，或让上层来组合（不要横向互相 import）',
  run: (ctx) => {
    const isolate = ctx.config.structure.isolate
    if (isolate.length === 0) return []
    const dimensions = new Set(isolate)
    const byRel = new Map(ctx.records.map((record) => [record.rel, record]))
    const out: Finding[] = []
    for (const record of ctx.records) {
      if (record.layer >= 90) continue
      if (!record.groupName || !dimensions.has(record.groupName)) continue
      for (const target of ctx.graph.edges.get(record.rel) ?? []) {
        const to = byRel.get(target)
        if (!to || to.layer >= 90) continue
        if (to.groupName !== record.groupName) continue
        if (to.layer !== record.layer) continue
        if (to.group === record.group) continue
        // 官方 `@x`：被指名的调用方可以跨切片拿（唯一出口）
        if (crossImportAllowed(record, to)) continue
        out.push(
          finding(
            'S22',
            record.rel,
            1,
            `组间直连：第 ${record.layer} 层的「${record.group}」引用了同层另一组「${to.group}」的 ${target}`,
          ),
        )
      }
    }
    return out
  },
}

/* ---------------- S23 公开面（组必须有入口，且组外不许绕过它） ---------------- */

/**
 * 三条判据（前两条由 `structure.publicApi` 里的组维度触发，第三条由 `structure.publicApiUnits` 触发）：
 *   ① 某个组一个入口文件都没有 → 报一条（锚在组内字典序最小的文件上，保证报告稳定）；
 *   ② 从**组外**（或同维度另一个组）直接引用组内**非入口**文件 = 绕过公开面；
 *   ③ 没有组维度的"单元"（如 `shared/ui`：角色 pattern 里没有 `{name}` 捕获）也必须有入口；
 *      `children: true` 时改为要求它的一级子目录各有入口。
 *
 * "入口"由角色描述符的 `entry: true` 标记 —— 仍然是角色表里的一份数据，不是硬编码文件名：
 * 我们三根范式的入口是 `routes.tsx`，FSD 的是 `index.ts`，同一条规则都能表达。
 */
export const declaredPublicApi: Rule = {
  id: 'S23',
  domain: 'structure',
  level: 'L3',
  severity: 'error',
  title: '公开面',
  hint: '组必须有公开面入口（三根是 routes.tsx、FSD 是 index.ts），且组外只能从入口进',
  run: (ctx) => {
    const dimensions = new Set(ctx.config.structure.publicApi)
    const units = ctx.config.structure.publicApiUnits ?? []
    if (dimensions.size === 0 && units.length === 0) return []
    const entryRoles = new Set(
      ctx.config.roles.filter((role) => role.entry === true).map((role) => role.id),
    )
    const byRel = new Map(ctx.records.map((record) => [record.rel, record]))
    const out: Finding[] = []

    // ① 每个组都必须有入口
    const groups = new Map<
      string,
      { layer: number; group: string; anchor: string; entry: boolean }
    >()
    for (const record of ctx.records) {
      if (record.layer >= 90) continue
      if (!record.groupName || !dimensions.has(record.groupName) || !record.group) continue
      const key = `${record.layer}:${record.groupName}:${record.group}`
      const seen = groups.get(key) ?? {
        layer: record.layer,
        group: record.group,
        anchor: record.rel,
        entry: false,
      }
      if (record.rel < seen.anchor) seen.anchor = record.rel
      seen.entry = seen.entry || entryRoles.has(record.role)
      groups.set(key, seen)
    }
    for (const group of groups.values()) {
      if (group.entry) continue
      out.push(
        finding(
          'S23',
          group.anchor,
          1,
          `组「${group.group}」（第 ${group.layer} 层）没有任何公开面入口：组内文件都没命中标记为 entry 的角色`,
        ),
      )
    }

    // ② 组外不许绕过公开面
    for (const record of ctx.records) {
      if (record.layer >= 90) continue
      for (const target of ctx.graph.edges.get(record.rel) ?? []) {
        const to = byRel.get(target)
        if (!to || to.layer >= 90) continue
        if (!to.groupName || !dimensions.has(to.groupName) || !to.group) continue
        const sameGroup =
          record.groupName === to.groupName &&
          record.layer === to.layer &&
          record.group === to.group
        if (sameGroup) continue
        if (entryRoles.has(to.role)) continue
        // 官方 `@x`：被指名的调用方可以直接引它（那是显式的跨引用公开面，不是"绕过"）
        if (crossImportAllowed(record, to)) continue
        out.push(
          finding(
            'S23',
            record.rel,
            1,
            `绕过公开面：直接引用了组「${to.group}」内部文件 ${target}（应当从它的入口进）`,
          ),
        )
      }
    }

    // ③ 无组维度的单元（没有 {name} 捕获的角色目录）也要有公开面
    for (const unit of units) {
      const roleRecords = ctx.records.filter((record) => record.role === unit.role)
      const dir = unitDirOf(ctx.config.roles, unit.role, roleRecords)
      if (dir === null) continue
      // 单元里的文件按**目录**收，不按角色收：入口文件自己的角色是另一个 id（`…:index`），
      // 只按单元角色收会把入口漏掉，于是"有 index.ts 也说没有"（实测踩过）。
      const members = ctx.records
        .map((record) => record.rel)
        .filter((rel) => rel.startsWith(`${dir}/`))
        .sort()
      if (members.length === 0) continue
      if (unit.children === true) {
        // 片段根自己就有入口 → 不再逐个要求一级子目录（与社区文件系统模型同口径：
        // 它先看 `getIndexes(segment)`，非空就整段跳过；否则会对着"已经用 barrel 收口"的项目刷一堆误报）
        const rootDepth = dir.split('/').length + 1
        const rootHasEntry = members.some(
          (rel) =>
            rel.split('/').length === rootDepth && entryRoles.has(byRel.get(rel)?.role ?? ''),
        )
        if (rootHasEntry) continue
        // 要求**一级子目录**各有入口（FSD 的 shared/ui、shared/lib 是这个形状）
        const children = new Map<string, string>()
        for (const rel of members) {
          const rest = rel === dir ? '' : rel.slice(dir.length + 1)
          const [head, ...tail] = rest.split('/')
          if (head === undefined || head === '' || tail.length === 0) continue
          if (!children.has(head)) children.set(head, rel)
        }
        for (const [child, anchor] of children) {
          const hasEntry = members.some(
            (rel) =>
              rel.startsWith(`${dir}/${child}/`) && entryRoles.has(byRel.get(rel)?.role ?? ''),
          )
          if (hasEntry) continue
          out.push(
            finding(
              'S23',
              anchor,
              1,
              `单元 ${dir} 的子目录「${child}」没有公开面入口（单元外只能从入口进）`,
              `在 ${dir}/${child}/ 放一个入口文件，或在角色表里把该文件标记为 entry: true`,
            ),
          )
        }
        continue
      }
      const hasEntry = members.some((rel) => entryRoles.has(byRel.get(rel)?.role ?? ''))
      if (hasEntry) continue
      out.push(
        finding(
          'S23',
          members[0] as string,
          1,
          `单元 ${dir} 没有公开面入口：目录里的文件都没命中标记为 entry 的角色`,
        ),
      )
    }
    return out
  },
}

export const declaredStructureRules: Rule[] = [layerOrder, groupIsolation, declaredPublicApi]
