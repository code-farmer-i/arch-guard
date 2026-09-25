import { resolveSpecifier } from '../../../engine/graph.js'
import type { Finding, Rule, RuleContext } from '../../../engine/types.js'
import { globToRegExp } from '../../../engine/util.js'

import {
  callSiteGroupsOf,
  envReadApisOf,
  envReadsInOf,
  fetchApisOf,
  fetchInOf,
} from './face-forms.js'
import { finding } from './structure-util.js'

/**
 * 「这类调用 / 引用该发生在哪」三条：
 *
 * - **S36 取数只在声明的落点**：页面里直接 `useQuery`、域里直接 `fetch('/api/x')` ——
 *   换数据层要翻遍页面、契约类型散在各域、测试必须 mock 网络。
 * - **S37 页面必须动态 import**：路由表静态 import 页面 → 所有页面进主包（首屏变大）。
 * - **S38 调用只在声明的落点**：按 `callSites([…])` 声明的组判（副作用：埋点/上报与本地存储；
 *   配置对象：`new QueryClient()` / `createTheme()`）—— 隐私判断、加密、换 SDK、单实例都无处统一。
 *
 * 三条都**声明了才判**（没声明 → 明列停用），判据都来自已有事实（`facts.calls` / `facts.imports`）。
 */

/**
 * 调用名匹配：**整名 / 对象前缀 / 方法后缀**三种写法都算。
 *
 * - `useQuery` ↔ `useQuery`（整名）
 * - `localStorage` ↔ `localStorage.getItem`（对象前缀：内置对象的方法名不必逐个声明）
 * - `invalidateQueries` ↔ `queryClient.invalidateQueries`（方法后缀：接收者变量名由项目决定）
 */
const calledApiOf = (callee: string, apis: string[]): string | null =>
  apis.find(
    (api) => callee === api || callee.startsWith(`${api}.`) || callee.endsWith(`.${api}`),
  ) ?? null

const isTestFile = (rel: string): boolean => /\.(test|spec)\./.test(rel)

/**
 * 「这类调用只许出现在声明的落点」的公共骨架（S36 取数 / S38 副作用）：
 * 跳过测试文件（renderHook、mock storage 都是正常用法）、跳过落点内的文件，其余一律报。
 */
function callSitesOutside(
  ctx: RuleContext,
  rule: string,
  apis: string[],
  globs: string[],
  texts: (info: { callee: string; api: string }) => { text: string; hint: string },
): Finding[] {
  if (apis.length === 0 || globs.length === 0) return []
  const patterns = globs.map((glob) => globToRegExp(glob))
  const out: Finding[] = []
  for (const record of ctx.records) {
    if (record.role === 'test' || isTestFile(record.rel)) continue
    if (patterns.some((pattern) => pattern.test(record.rel))) continue
    const facts = ctx.facts.get(record.rel)
    if (!facts) continue
    for (const call of facts.calls) {
      const api = calledApiOf(call.callee, apis)
      if (!api) continue
      const { text, hint } = texts({ callee: call.callee, api })
      out.push(finding(rule, record.rel, call.line, text, hint))
    }
  }
  return out
}

/* ---------------- S36 取数只在声明的落点 ---------------- */

export const fetchOnlyInDeclaredSites: Rule = {
  id: 'S36',
  domain: 'structure',
  level: 'L2',
  severity: 'error',
  title: '取数只在声明的落点',
  hint: '取数落在一处（域内 hooks/ 或 shared/api）：页面只消费，换方案时不动页面，测试也不必 mock 网络',
  requires: ['dataLayer.fetchApis', 'dataLayer.fetchIn'],
  run: (ctx) =>
    callSitesOutside(ctx, 'S36', fetchApisOf(ctx.config), fetchInOf(ctx.config), ({ callee }) => ({
      text: `在这里取数（${callee}）：取数只许出现在声明的落点`,
      hint: '把取数移进域内 hooks/（或 shared/api），页面改成消费那个 hook —— 这样换方案不用动页面',
    })),
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

/* ---------------- S38 调用只在声明的落点（副作用 / 配置对象…） ---------------- */

/**
 * 一组一类：`callSites([{ name: '副作用', apis: [...], in: [...] }, …])`。
 * 报告里带上组名，所以「副作用散在页面里」与「域里自建 QueryClient」能一眼分开。
 */
export const callsOnlyInDeclaredSites: Rule = {
  id: 'S38',
  domain: 'structure',
  level: 'L2',
  severity: 'error',
  title: '调用只在声明的落点',
  hint: '同类调用在项目里各留一处封装（隐私判断、加密、迁移、单实例都在那儿做）：散着写，换 SDK / 换方案 / 排查双实例都得全仓找',
  requires: ['callSites.groups'],
  run: (ctx) => {
    const out: Finding[] = []
    for (const group of callSiteGroupsOf(ctx.config)) {
      out.push(
        ...callSitesOutside(ctx, 'S38', group.apis, group.in, ({ callee }) => ({
          text: `在这里调用${group.name} API（${callee}）：它只许出现在声明的落点`,
          hint: `把这次调用收进项目里的封装（${group.in.join(' / ')}），别处只调封装`,
        })),
      )
    }
    return out
  },
}

/* ---------------- S44 环境读取只在声明的落点 ---------------- */

/**
 * 判据：声明了"哪些环境读取 + 只许在哪读"之后，落点外的 `import.meta.env.X` / `process.env.X` 即报。
 *
 * 场景：`import.meta.env.VITE_API_BASE` 在十几个文件里直接读 —— 改名 / 换环境全仓搜，
 * 读到的还是**原始字符串**（没有默认值、没有校验、没有类型）。收进配置模块，别处只消费。
 */
export const envReadsOnlyInDeclaredSites: Rule = {
  id: 'S44',
  domain: 'structure',
  level: 'L2',
  severity: 'error',
  title: '环境读取只在声明的落点',
  hint: '环境变量 / 构建期开关收进配置模块（带默认值与校验），别处只消费——散着读，改名与换环境都要全仓搜',
  requires: ['envReads.apis', 'envReads.in'],
  run: (ctx) => {
    const apis = envReadApisOf(ctx.config)
    const globs = envReadsInOf(ctx.config)
    if (apis.length === 0 || globs.length === 0) return []
    const patterns = globs.map((glob) => globToRegExp(glob))
    const out: Finding[] = []
    for (const record of ctx.records) {
      if (record.role === 'test' || isTestFile(record.rel)) continue
      if (patterns.some((pattern) => pattern.test(record.rel))) continue
      const facts = ctx.facts.get(record.rel)
      if (!facts) continue
      for (const read of facts.reads) {
        const hit = apis.find((api) => read.name === api || read.name.startsWith(`${api}.`)) ?? null
        if (!hit) continue
        out.push(
          finding(
            'S44',
            record.rel,
            read.line,
            `在这里读环境（${read.name}）：读取只许出现在声明的落点`,
            `收进配置模块（${globs.join(' / ')}）并给出默认值，别处 import 它`,
          ),
        )
      }
    }
    return out
  },
}

export const structureCallSiteRules: Rule[] = [
  fetchOnlyInDeclaredSites,
  viewsAreLazy,
  callsOnlyInDeclaredSites,
  envReadsOnlyInDeclaredSites,
]
