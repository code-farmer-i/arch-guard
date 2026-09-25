import { resolveSpecifier } from '../../../engine/graph.js'
import type { Finding, Rule } from '../../../engine/types.js'
import { globToRegExp } from '../../../engine/util.js'

import { finding } from './structure-util.js'
import { fetchApisOf, fetchInOf } from './face-forms.js'

/**
 * 「这类调用该发生在哪」两条：
 *
 * - **S36 取数只在声明的落点**：页面里直接 `useQuery`、域里直接 `fetch('/api/x')` ——
 *   换数据层要翻遍页面、契约类型散在各域、测试必须 mock 网络。现在拦住。
 * - **S37 页面必须动态 import**：路由表静态 import 页面 → 所有页面进主包（首屏变大）。
 *
 * 两条都**声明了才判**（没声明 → 明列停用），判据分别是 `facts.calls[].callee` 与
 * `facts.imports[].dynamic` —— 都已存在的事实，不需要新解析。
 */

/** 取数 API 的匹配：整名，或 `.` 后缀（声明 `invalidateQueries` 也能抓 `queryClient.invalidateQueries`） */
const callsApi = (callee: string, apis: string[]): string | null =>
  apis.find((api) => callee === api || callee.endsWith(`.${api}`)) ?? null

const isTestFile = (rel: string): boolean => /\.(test|spec)\./.test(rel)

/* ---------------- S36 取数只在声明的落点 ---------------- */

export const fetchOnlyInDeclaredSites: Rule = {
  id: 'S36',
  domain: 'structure',
  level: 'L2',
  severity: 'error',
  title: '取数只在声明的落点',
  hint: '取数落在一处（域内 hooks/ 或 shared/api）：页面只消费，换方案时不动页面，测试也不必 mock 网络',
  requires: ['dataLayer.fetchApis', 'dataLayer.fetchIn'],
  run: (ctx) => {
    const apis = fetchApisOf(ctx.config)
    const patterns = fetchInOf(ctx.config).map((glob) => globToRegExp(glob))
    if (apis.length === 0 || patterns.length === 0) return []
    const out: Finding[] = []
    for (const record of ctx.records) {
      // 测试里调 useQuery（renderHook）是正常的，不判
      if (record.role === 'test' || isTestFile(record.rel)) continue
      if (patterns.some((pattern) => pattern.test(record.rel))) continue
      const facts = ctx.facts.get(record.rel)
      if (!facts) continue
      for (const call of facts.calls) {
        const hit = callsApi(call.callee, apis)
        if (!hit) continue
        out.push(
          finding(
            'S36',
            record.rel,
            call.line,
            `在这里取数（${call.callee}）：取数只许出现在声明的落点`,
            '把取数移进域内 hooks/（或 shared/api），页面改成消费那个 hook —— 这样换方案不用动页面',
          ),
        )
      }
    }
    return out
  },
}

/* ---------------- S37 页面必须动态 import ---------------- */

/**
 * 页面被**域入口**静态 import 就报：那是"所有页面进主包"的直接原因。
 * 组件之间互相引用不管（那不是首屏问题），入口不在契约内也不管（S03 会报角色缺口）。
 */
export const viewsAreLazy: Rule = {
  id: 'S37',
  domain: 'structure',
  level: 'L2',
  severity: 'error',
  title: '页面必须动态 import',
  hint: '路由入口用 `lazy: () => import("./views/X")`：静态 import 会把所有页面打进主包，首屏跟着变大',
  requires: ['structure.lazyViews'],
  run: (ctx) => {
    if (ctx.config.params.lazyViews !== true) return []
    const files = new Set(ctx.files)
    const byRel = new Map(ctx.records.map((record) => [record.rel, record]))
    const out: Finding[] = []
    for (const record of ctx.records) {
      if (record.slot !== 'views') continue
      if (!/\.tsx?$/.test(record.rel)) continue
      for (const importer of ctx.graph.importers.get(record.rel) ?? []) {
        const importerRecord = byRel.get(importer)
        // 只要求"域的入口"这一侧懒加载；入口本身不在契约里是 S03 的活
        if (!importerRecord || importerRecord.slot !== 'routes') continue
        const facts = ctx.facts.get(importer)
        if (!facts) continue
        const edge = facts.imports.find(
          (imported) => resolveSpecifier(imported.spec, importer, ctx.config, files) === record.rel,
        )
        if (!edge || edge.dynamic) continue
        out.push(
          finding(
            'S37',
            importer,
            edge.line,
            `页面 ${record.rel} 被入口静态 import：它会随主包一起下载`,
            `改成懒加载：lazy: () => import('${edge.spec}')（需要预取就再加 preload）`,
          ),
        )
      }
    }
    return out
  },
}

export const structureCallSiteRules: Rule[] = [fetchOnlyInDeclaredSites, viewsAreLazy]
