import type { Finding, Rule, RuleContext } from '../../../engine/types.js'

/**
 * 依赖方向的图规则（S04–S09、S15、S17、S18）。
 *
 * 这一组全部落在 L3：判据是**依赖图**而不是单文件文本，所以能抓住「域间互引」「views 被外部
 * 直接引用」「shared 反向依赖」「孤儿文件」这些靠 grep 看不出来的问题。
 */

const finding = (
  rule: string,
  file: string,
  line: number,
  text: string,
  hint?: string,
): Finding => ({
  rule,
  file,
  line,
  text,
  ...(hint ? { hint } : {}),
})

const isModule = (rel: string, modulesRoot: string): boolean => rel.startsWith(`${modulesRoot}/`)
const domainOf = (rel: string, modulesRoot: string): string | null => {
  if (!isModule(rel, modulesRoot)) return null
  return rel.slice(modulesRoot.length + 1).split('/')[0] ?? null
}
const isShared = (rel: string, sharedRoot: string): boolean => rel.startsWith(`${sharedRoot}/`)

/**
 * 域根与共享根**从配置的 layout 读**，不再自己拼 `${srcRoot}/modules`。
 *
 * 为什么必须这样：`canonical({ modules: 'src/features' })` 时角色表跟着参数变了（S01 不再报"无处安放"），
 * 但这里如果还查 `src/modules`，图规则就会查一个不存在的目录 → 静默空转 → 跨域引用私有 views
 * 一条都不报，门禁显示"通过"（假绿）。**layout 是预设算好的唯一真相**：
 * `canonical()` 里同一组 app/modules/shared 变量同时喂给角色表与 layout。
 *
 * 空串表示「这个概念在本范式里不存在」（如库范式没有域与共享层）——
 * `rel.startsWith('/')` 恒假，依赖它的规则自然空转，正是该有的行为。
 */
const rootsOf = (ctx: RuleContext): { modulesRoot: string; sharedRoot: string } => ({
  modulesRoot: ctx.config.layout.modules,
  sharedRoot: ctx.config.layout.shared,
})

/* ---------------- S04 域内 import 前缀白名单 ---------------- */

export const domainImportWhitelist: Rule = {
  id: 'S04',
  domain: 'structure',
  level: 'L3',
  severity: 'error',
  title: '域内 import 只许自己 / shared / 第三方',
  hint: '域是自治单元：要复用的东西上移到 shared，别跨域取；跨域只经 routes',
  run: (ctx) => {
    const { modulesRoot, sharedRoot } = rootsOf(ctx)
    const out: Finding[] = []
    for (const record of ctx.records) {
      const domain = record.domain
      if (!domain || !isModule(record.rel, modulesRoot)) continue
      for (const target of ctx.graph.edges.get(record.rel) ?? []) {
        if (target.startsWith(`${modulesRoot}/`)) {
          const other = domainOf(target, modulesRoot)
          if (other === domain) continue
          // 跨域只允许落在对方的 routes（由 S05 判定入口是否合法）
          if (other && target === `${modulesRoot}/${other}/routes.tsx`) continue
          out.push(finding('S04', record.rel, 1, `域 ${domain} 跨域引用：${target}`))
          continue
        }
        if (isShared(target, sharedRoot) || target.startsWith(`${ctx.config.srcRoot}/app/`))
          continue
        out.push(finding('S04', record.rel, 1, `域内出现了白名单外的引用：${target}`))
      }
    }
    return out
  },
}

/* ---------------- S05 域外只许引用域的路由入口 ---------------- */

export const crossDomainViaRoutes: Rule = {
  id: 'S05',
  domain: 'structure',
  level: 'L3',
  severity: 'error',
  title: '域外只许 import 域的 routes',
  hint: '域是黑盒：外部只挂载它的 routes，不直接 import 里面的组件',
  run: (ctx) => {
    const { modulesRoot } = rootsOf(ctx)
    const out: Finding[] = []
    for (const record of ctx.records) {
      const from = domainOf(record.rel, modulesRoot)
      for (const target of ctx.graph.edges.get(record.rel) ?? []) {
        const to = domainOf(target, modulesRoot)
        if (!to || to === from) continue
        if (target === `${modulesRoot}/${to}/routes.tsx`) continue
        out.push(finding('S05', record.rel, 1, `跨域引用了 ${to} 的内部文件：${target}`))
      }
    }
    return out
  },
}

/* ---------------- S06 views 对域外私有 ---------------- */

export const viewsArePrivate: Rule = {
  id: 'S06',
  domain: 'structure',
  level: 'L3',
  severity: 'error',
  title: 'views 对域外私有',
  hint: 'views 是本域的页面实现；别域要用就把它下沉成 shared 组件，或走对方 routes',
  run: (ctx) => {
    const { modulesRoot } = rootsOf(ctx)
    const out: Finding[] = []
    const privateSlots = new Set(['views', 'components', 'hooks', 'model', 'lib'])
    for (const record of ctx.records) {
      const from = domainOf(record.rel, modulesRoot)
      for (const target of ctx.graph.edges.get(record.rel) ?? []) {
        const to = domainOf(target, modulesRoot)
        if (!to || to === from) continue
        const targetRecord = ctx.records.find((item) => item.rel === target)
        if (!targetRecord?.slot || !privateSlots.has(targetRecord.slot)) continue
        if (targetRecord.slot === 'views') {
          out.push(finding('S06', record.rel, 1, `${to}/views 被域外引用：${target}`))
        }
      }
    }
    return out
  },
}

/* ---------------- S09 layouts 不得 import modules ---------------- */

export const layoutsDoNotImportModules: Rule = {
  id: 'S09',
  domain: 'structure',
  level: 'L3',
  severity: 'error',
  title: 'layouts 不得 import modules',
  hint: '外壳只负责装配；它引用具体业务域就会变成「改一个域要动外壳」',
  run: (ctx) => {
    const { modulesRoot } = rootsOf(ctx)
    const out: Finding[] = []
    for (const record of ctx.records) {
      if (!record.role.includes('layouts')) continue
      for (const target of ctx.graph.edges.get(record.rel) ?? []) {
        if (isModule(target, modulesRoot)) {
          out.push(finding('S09', record.rel, 1, `layouts 引用了业务域：${target}`))
        }
      }
    }
    return out
  },
}

/* ---------------- S15 可达性 ---------------- */

export const reachability: Rule = {
  id: 'S15',
  domain: 'structure',
  level: 'L3',
  severity: 'error',
  title: '可达性：无孤儿、routes 必被聚合、view 必被引用',
  hint: '没被任何入口用到的东西等于死代码；域 routes 没被 app/router 挂载就是整域不可达',
  run: (ctx) => {
    const { modulesRoot } = rootsOf(ctx)
    const out: Finding[] = []
    const isTest = (rel: string): boolean => /\.(test|spec)\./.test(rel)

    // ① 孤儿文件：从 entries 出发不可达（测试、d.ts、以及**没有角色的非源码文件**不算：
    //    配置文件、index.html 天然不被 src 入口引用，把它们报成孤儿是纯噪音）
    const byRel = new Map(ctx.records.map((record) => [record.rel, record]))
    for (const orphan of ctx.graph.orphaned) {
      const record = byRel.get(orphan)
      if (!record) continue
      // routes / views 有各自更精确的判定（②③），这里不重复报「不可达」
      if (record.slot === 'routes' || record.slot === 'views') continue
      if (isTest(orphan) || orphan.endsWith('.d.ts') || orphan.endsWith('.css')) continue
      out.push(finding('S15', orphan, 1, '孤儿文件：从任何入口都不可达'))
    }

    const appRecords = ctx.records.filter((record) => record.role.startsWith('app:'))
    const importerRolesOf = (rel: string): string[] =>
      [...(ctx.graph.importers.get(rel) ?? [])].map(
        (importer) => ctx.records.find((record) => record.rel === importer)?.role ?? '',
      )

    for (const record of ctx.records) {
      // ② 域 routes 必须被 app 层聚合
      if (record.slot === 'routes') {
        const aggregated = importerRolesOf(record.rel).some((role) => role.startsWith('app:'))
        if (!aggregated && appRecords.length > 0) {
          out.push(finding('S15', record.rel, 1, '域 routes 没有被 app/router 聚合'))
        }
        continue
      }
      // ③ 每个 view 必须被本域 routes 引用
      if (record.slot === 'views') {
        // 只判代码文件：views/ 下的 .module.css 是页面样式，不是"没被引用的页面"
        if (!/\.tsx?$/.test(record.rel)) continue
        const domain = domainOf(record.rel, modulesRoot)
        const routes = domain ? `${modulesRoot}/${domain}/routes.tsx` : null
        // 域里根本没有 routes.tsx 是 S14 的活（「有 views 必须有 routes」），这里不重复报
        if (!routes || !byRel.has(routes)) continue
        const referenced = ctx.graph.importers.get(record.rel)?.has(routes) ?? false
        if (!referenced) out.push(finding('S15', record.rel, 1, `view 没有被 ${routes} 引用`))
      }
    }
    return out
  },
}

/* ---------------- S17 同一导出名两处定义 ---------------- */

export const duplicateExportNames: Rule = {
  id: 'S17',
  domain: 'structure',
  level: 'L2',
  severity: 'warn',
  title: '同一导出名在两处定义',
  hint: '很可能是复制粘贴出来的两套实现；确认是否该合成一份',
  run: (ctx) => {
    const byName = new Map<string, string[]>()
    for (const record of ctx.records) {
      if (record.kind !== 'ts') continue
      const facts = ctx.facts.get(record.rel)
      if (!facts) continue
      for (const item of facts.exports) {
        if (item.isDefault || item.typeOnly) continue
        // 只认真正的定义：`export { App }`（转出）不是第二处实现 —— clean 夹具的误报就出在这里
        if (item.declared !== true) continue
        // 只盯「业务命名」：组件（大写开头）与 hook（use*）才值得查重
        if (!/^[A-Z]/.test(item.name) && !item.name.startsWith('use')) continue
        const list = byName.get(item.name) ?? []
        list.push(record.rel)
        byName.set(item.name, list)
      }
    }
    const out: Finding[] = []
    for (const [name, files] of byName) {
      if (files.length < 2) continue
      out.push(
        finding('S17', files[1] as string, 1, `导出名 ${name} 在 ${files.length} 个文件里都有定义`),
      )
      if (out.length >= 20) break
    }
    return out
  },
}

/* ---------------- S18 shared 只被一个域使用 ---------------- */

export const sharedUsedByOneDomain: Rule = {
  id: 'S18',
  domain: 'structure',
  level: 'L3',
  severity: 'warn',
  title: 'shared 只被一个域使用',
  hint: '只有单个域在用说明它其实是那个域的私有件，下沉到 modules/<域>/ 更诚实',
  run: (ctx) => {
    const { modulesRoot, sharedRoot } = rootsOf(ctx)
    // 域数 <2 时这条没有意义：单域项目里每个 shared 文件都「只被一个域用」
    const domainsInProject = new Set(
      ctx.records
        .map((record) => domainOf(record.rel, modulesRoot))
        .filter((item): item is string => item !== null),
    )
    if (domainsInProject.size < 2) return []
    const out: Finding[] = []
    for (const record of ctx.records) {
      if (!isShared(record.rel, sharedRoot)) continue
      // 只判「实现类」文件；样式与类型天然被广泛引用
      if (record.kind !== 'ts' || record.slot === 'styles') continue
      const domains = new Set<string>()
      for (const importer of ctx.graph.importers.get(record.rel) ?? []) {
        const domain = domainOf(importer, modulesRoot)
        if (domain) domains.add(domain)
      }
      if (domains.size === 1) {
        out.push(finding('S18', record.rel, 1, `只被域 ${[...domains][0]} 使用，考虑下沉到该域内`))
      }
    }
    return out
  },
}

/* ---------------- S08 依赖环 ---------------- */

/**
 * 判据：图里的环（`graph.cycles`）。至少有一个**契约内文件**的环才报 ——
 * 纯外部脚本之间的环不属于这份契约（`include` 之外的文件照常进图，但不归目录契约管）。
 *
 * 与 S15（可达性）的分工：S15 说"没人用"，S08 说"互相用"。
 * 一条环只报一次，锚在环内字典序最小的文件上（报告稳定，棘轮要靠它）。
 */
export const noCycles: Rule = {
  id: 'S08',
  domain: 'structure',
  level: 'L3',
  severity: 'error',
  title: '依赖环',
  hint: '环让"依赖单向"失效：把共用部分下沉到更低的层，或用依赖倒置把环拆开',
  run: (ctx) => {
    const byRel = new Map(ctx.records.map((record) => [record.rel, record]))
    const out: Finding[] = []
    for (const cycle of ctx.graph.cycles) {
      if (!cycle.some((rel) => byRel.has(rel))) continue
      const anchor = [...cycle].sort()[0] as string
      const head = cycle.length > 6 ? [...cycle.slice(0, 6), '…'] : cycle
      out.push(
        finding(
          'S08',
          anchor,
          1,
          `依赖环：${head.join(' → ')} → ${cycle[0]}（共 ${cycle.length} 个文件）`,
        ),
      )
    }
    return out
  },
}

/* ---------------- S33 导入必须解析得到 ---------------- */

/**
 * 判据：契约内文件的相对 / 别名说明符**解析不到**（`graph.unresolved`）。
 *
 * 为什么必须有这条：解析不到的边在图上**不存在**，于是所有图规则都看不见它 ——
 * 把跨层违规写成 `../dash/ui/Dash`（少一层 `..`）是零成本的绕过口子。
 * 只判契约内的文件：`include` 之外（构建配置、脚本）写错路径不归目录契约管。
 */
export const unresolvedImports: Rule = {
  id: 'S33',
  domain: 'structure',
  level: 'L3',
  severity: 'error',
  title: '导入必须解析得到',
  hint: '项目内的相对 / 别名路径必须指向真实文件：写错路径会让这条依赖在图上消失，门禁看不见它',
  run: (ctx) => {
    const out: Finding[] = []
    for (const record of ctx.records) {
      const specs = ctx.graph.unresolved.get(record.rel)
      if (!specs || specs.length === 0) continue
      const imports = ctx.facts.get(record.rel)?.imports ?? []
      for (const spec of [...new Set(specs)].sort()) {
        const line = imports.find((item) => item.spec === spec)?.line ?? 1
        out.push(
          finding(
            'S33',
            record.rel,
            line,
            `导入解析不到：${spec}（路径写错 / 文件被删 / 别名没配）`,
          ),
        )
      }
    }
    return out
  },
}

/* ---------------- S34 文件级入/出度上限 ---------------- */

/**
 * 判据：命中声明角色的文件，**项目内**入度 / 出度超过 `structure.degreeLimits` 给的上限。
 *
 * 与 S26/S28 的分工：那两条看**组**（切片维度），这条看**单个文件** ——
 * 「被 80 个文件引用」（改动波及全项目）与「引用了 40 个模块」（神模块）在组粒度上都看不见。
 * 只数项目内边（包依赖另有 M07 `depsBudget` 管），阈值由宿主动声明（`maxIn` / `maxOut` 至少给一个）。
 */
export const degreeLimits: Rule = {
  id: 'S34',
  domain: 'structure',
  level: 'L3',
  severity: 'error',
  title: '文件级入/出度上限',
  hint: '入度太高说明改动会波及全项目（抽接口或拆分）；出度太高说明这个文件什么都干（按职责拆）',
  run: (ctx) => {
    const limits = ctx.config.structure.degreeLimits ?? []
    if (limits.length === 0) return []
    const out: Finding[] = []
    for (const record of ctx.records) {
      for (const limit of limits) {
        if (record.role !== limit.role) continue
        const fanIn = ctx.graph.importers.get(record.rel)?.size ?? 0
        const fanOut = ctx.graph.edges.get(record.rel)?.size ?? 0
        if (limit.maxIn !== undefined && fanIn > limit.maxIn) {
          out.push(
            finding(
              'S34',
              record.rel,
              1,
              `入度 ${fanIn} 个文件，超过上限 ${limit.maxIn}：太多地方依赖它，改动会波及全项目（抽接口 / 拆分 / 收窄公开面）`,
            ),
          )
        }
        if (limit.maxOut !== undefined && fanOut > limit.maxOut) {
          out.push(
            finding(
              'S34',
              record.rel,
              1,
              `出度 ${fanOut} 个项目内文件，超过上限 ${limit.maxOut}：这个文件什么都干（按职责拆，或把工具性代码下沉）`,
            ),
          )
        }
      }
    }
    return out
  },
}

export const structureGraphRules: Rule[] = [
  domainImportWhitelist,
  crossDomainViaRoutes,
  viewsArePrivate,
  // 依赖环不再委派：`graph.cycles` 本来就算好了，委派出去只会让不装 dc / eslint 的宿主失去覆盖
  noCycles,
  layoutsDoNotImportModules,
  reachability,
  duplicateExportNames,
  sharedUsedByOneDomain,
  unresolvedImports,
  degreeLimits,
]
