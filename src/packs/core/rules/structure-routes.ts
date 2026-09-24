import type { Finding, Rule } from '../../../engine/types.js'

import { presentFilesOf, routeEntriesOf, routeFilesOf } from './face-forms.js'
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
    const allowed = new Set(routeFiles)
    const names = routeFiles.join(' / ')
    const out: Finding[] = []
    for (const rel of [...ctx.scan.missing, ...ctx.scan.ambiguous.map((entry) => entry.rel)]) {
      if (!rel.startsWith(`${modulesRoot}/`)) continue
      const rest = rel.slice(modulesRoot.length + 1)
      const segments = rest.split('/')
      // 域根下的文件：modules/<域>/<file>
      if (segments.length !== 2) continue
      if (rel.endsWith('.d.ts')) continue
      const name = segments[1] as string
      if (allowed.has(name)) {
        /**
         * 名字对，但**这个文件没命中任何角色**（S03 只看 `scan.missing`）→ 角色表没跟上词汇。
         *
         * 必须显式报出来：没有角色的文件**不进解析**（`collectSources` 只解析命中角色的文件），
         * 于是它的 import 在图上不存在 —— S15③ 会以为 view 没人引用、S04/S05 也看不到入口侧的跨域引用。
         * 与其让那几条规则各报一句莫名其妙的错，不如在这里说清"角色表要跟着 `router.routeFiles` 改"。
         */
        out.push(
          finding(
            'S03',
            rel,
            1,
            `域入口 ${name} 不在目录契约内：角色表里没有它的角色`,
            '在角色表里给域入口一个角色（`canonical()` 默认是 routes.{ts,tsx}；自定义入口名用 overrides.addRoles 追加，见 docs/DESIGN.md §7.2(2.1)）',
          ),
        )
        continue
      }
      out.push(
        finding(
          'S03',
          rel,
          1,
          // 词汇为空时另起一句：写成「域根只许 <空>」会被读成"这个文件叫这个名字"
          routeFiles.length > 0
            ? `域根目录只许 ${names}，出现了 ${name}`
            : `域根不该有文件（本方案未声明入口文件），出现了 ${name}`,
          placementHint(rel, ctx.config),
        ),
      )
    }
    /**
     * 反向：**角色表说是域入口，词汇里却没有这个名字** → 词汇与角色表不一致（同一件事的两处真相）。
     *
     * 只对域根那一层判（`modules/<域>/<文件>`）；词汇为空（文件路由）时不判 —— 那种方案本来就
     * 不该有槽位为 `routes` 的角色。
     */
    if (routeFiles.length > 0) {
      for (const record of ctx.records) {
        if (record.slot !== 'routes') continue
        if (!record.rel.startsWith(`${modulesRoot}/`)) continue
        const segments = record.rel.slice(modulesRoot.length + 1).split('/')
        if (segments.length !== 2) continue
        if (allowed.has(segments[1] as string)) continue
        out.push(
          finding(
            'S03',
            record.rel,
            1,
            `${record.rel} 被角色表当作域入口，但方案面声明的入口是 ${names}：词汇与角色表不一致`,
            '把两者改成一致：改 `router.routeFiles`，或改角色表里那条 `slot: routes` 的角色',
          ),
        )
      }
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
    const present = presentFilesOf(ctx)
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
      domains.set(record.domain, entry)
    }
    /**
     * 入口**按方案面词汇判存在性**，不按角色 slot。
     *
     * 为什么：词汇被自定义过时（入口叫 `router.ts` / `entry.ts`），文件在新角色表里未必有
     * `slot: 'routes'`；用 slot 判会永远判不出 → 假阳性「有 views 但没有 router.ts」（文件就在那儿）。
     * 与 S03 / S04 / S05 / S15③ 统一成一份判据：**方案面声明了什么，就按什么判**。
     */
    for (const [domain, entry] of domains) {
      entry.hasRoutes = routeEntriesOf(ctx.config, domain).some((rel) => present.has(rel))
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
