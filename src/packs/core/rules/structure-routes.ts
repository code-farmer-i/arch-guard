import type { Finding, Rule } from '../../../engine/types.js'

import { routeFilesOf } from './face-forms.js'
import { placementHint } from './placement.js'
import { finding } from './structure-util.js'

/**
 * 域**公开面入口**的两条规则（S03 / S14）。
 *
 * 为什么单列一个模块：两条都要用「域的入口文件叫什么」这份词汇，而它以前**写死在规则里**
 * （`routes.tsx`），范式角色表写的却是 `routes.{ts,tsx}` —— 入口叫 `routes.ts` 的域会被
 * 误报。词汇现在只从 `./face-forms.js` 取（默认 `data/face-forms.ts`，`router` 面可覆盖）。
 */

/**
 * S03 文件必须落在某个槽位：域根目录只许域的公开面入口（`*.d.ts` 例外）。
 *
 * 与 S01 的分工：S01 管「src 下的目录白名单 + 角色表互斥完备」，S03 把「域根不放散件」
 * 这一条单独拎出来给更明确的提示，所以 S01 会跳过域根文件，避免同一处报两遍。
 */
export const domainRootOnlyRoutes: Rule = {
  id: 'S03',
  domain: 'structure',
  level: 'L1',
  severity: 'error',
  title: '域根目录只许域的公开面入口',
  hint: '域根只放域入口文件；页面进 views/、域内类型与常量进 model/、纯函数进 lib/、域内组件进 components/',
  run: (ctx) => {
    // 域根从 layout 读（唯一真相），不要再拼 `${srcRoot}/modules` —— 见 structure-graph 的 rootsOf
    const modulesRoot = ctx.config.layout.modules
    const routeFiles = routeFilesOf(ctx.config)
    /**
     * 词汇为空（文件路由：没有 per-domain 入口文件）时**照报不误**：
     * S01 已经把域根散件让给了 S03，这里再放行就等于域根没有任何规则看着 —— 静默失能。
     * 所以"没有入口文件名"只改变文案，不改变判定。
     */
    const names = routeFiles.length > 0 ? routeFiles.join(' / ') : '本方案未声明任何入口文件'
    const allowed = new Set(routeFiles)
    const out: Finding[] = []
    for (const rel of [...ctx.scan.missing, ...ctx.scan.ambiguous.map((entry) => entry.rel)]) {
      if (!rel.startsWith(`${modulesRoot}/`)) continue
      const rest = rel.slice(modulesRoot.length + 1)
      const segments = rest.split('/')
      // 域根下的文件：modules/<域>/<file>
      if (segments.length !== 2) continue
      if (allowed.has(segments[1] as string) || rel.endsWith('.d.ts')) continue
      out.push(
        finding(
          'S03',
          rel,
          1,
          `域根目录只许 ${names}，出现了 ${segments[1]}`,
          placementHint(rel, ctx.config),
        ),
      )
    }
    return out
  },
}

/** S14 有 views 的域必须有公开面入口（否则页面访问不到） */
export const routesRequired: Rule = {
  id: 'S14',
  domain: 'structure',
  level: 'L1',
  severity: 'error',
  title: '域路由分片必填',
  hint: '有页面就在域根建域入口文件（默认 routes.ts / routes.tsx）并导出 *Routes，由 app/router 聚合',
  run: (ctx) => {
    const routeFiles = routeFilesOf(ctx.config)
    // 文件路由（没有 per-domain 出口文件）：域本来就没有 routes 分片可填，不判
    if (routeFiles.length === 0) return []
    const domains = new Map<string, { hasViews: boolean; hasRoutes: boolean; sample: string }>()
    for (const record of ctx.records) {
      if (!record.domain) continue
      const entry = domains.get(record.domain) ?? {
        hasViews: false,
        hasRoutes: false,
        sample: record.rel,
      }
      if (record.slot === 'views') {
        entry.hasViews = true
        // 定位点优先用**第一个**代码文件：域级发现落在 .module.css 上会让人找不到北，
        // 但不能反复覆盖（否则定位点会随遍历顺序漂移，棘轮锚点也跟着漂）
        if (/\.tsx?$/.test(record.rel) && !/\.tsx?$/.test(entry.sample)) entry.sample = record.rel
      }
      // 入口由**角色表**认（`slot: 'routes'`），不靠文件名 —— 自定义过入口名的范式也成立
      if (record.slot === 'routes') entry.hasRoutes = true
      domains.set(record.domain, entry)
    }
    const names = routeFiles.join(' / ')
    const out: Finding[] = []
    for (const [domain, entry] of domains) {
      if (entry.hasViews && !entry.hasRoutes) {
        out.push(
          finding(
            'S14',
            entry.sample,
            1,
            `域 ${domain} 有 views/ 但没有 ${names}`,
            `补 modules/${domain}/${routeFiles[0] as string}`,
            true,
          ),
        )
      }
    }
    return out
  },
}
