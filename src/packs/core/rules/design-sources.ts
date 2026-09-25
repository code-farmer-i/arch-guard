import type { Finding, Rule, RuleContext } from '../../../engine/types.js'

import { finding } from './design-shared.js'
import {
  navigateCallsOf,
  pathPropsOf,
  pathSourceOf,
  presentFilesOf,
  queryKeyFromOf,
  queryKeyPropsOf,
} from './face-forms.js'

/**
 * 「字面量**唯一出处**」的两条（D22 缓存键 / D23 路由路径）：判据同形 ——
 * **某类字面量只许出现在声明的那个文件里**。
 *
 * 落点是**项目决定**（`dataLayer({ queryKeyFrom })` / `router({ pathSource })`），
 * 所以没声明时这两条由 `requires` 明列停用，而不是拿一个默认路径去量别人的项目（那只会误报）。
 * 判据来自 facts 的 `strings[].prop`（最近属性名）与 `calls[].stringArg`：
 * `{ queryKey: ['crews', id] }` 里的字面量在数组里，属性名靠 `prop` 透传拿到（见 engine/facts.ts）。
 */

/**
 * 声明的落点**必须真的有那个文件**：路径拼错时，逐条报"这里不该有字面量"会把整个项目刷红，
 * 而真正的问题是落点写错了。所以先报这一条（全局），本轮不再逐条报。
 */
function missingSource(
  ctx: RuleContext,
  rule: string,
  source: string,
  what: string,
): Finding | null {
  if (presentFilesOf(ctx).has(source)) return null
  return finding(
    rule,
    source,
    1,
    `声明的${what}唯一出处 ${source} 不存在：这一轮没有判"字面量该不该在这里"`,
    '把落点改成一个真实文件的路径；或从适配器里去掉这个声明（没声明时这条规则本来就停用）',
    true,
  )
}

/** D22 缓存键唯一出处 */
export const cacheKeySingleSource: Rule = {
  id: 'D22',
  domain: 'design',
  level: 'L2',
  severity: 'error',
  title: '缓存键只有一个出处',
  hint: '查询键只许来自声明的唯一出处（`dataLayer({ queryKeyFrom })`）；别在调用点手拼键 —— 手拼的键改名时漏一处就是缓存穿透',
  requires: ['dataLayer.queryKeyFrom'],
  run: (ctx) => {
    const source = queryKeyFromOf(ctx.config)
    // 没声明落点：真跑起来时本规则已被 `requires` 停用；直接调用（自检 / 单测）时也不该报"落点不存在"
    if (!source) return []
    const missing = missingSource(ctx, 'D22', source, '缓存键')
    if (missing) return [missing]
    const props = new Set(queryKeyPropsOf(ctx.config))
    const out: Finding[] = []
    for (const record of ctx.records) {
      if (record.rel === source) continue
      const facts = ctx.facts.get(record.rel)
      if (!facts) continue
      for (const item of facts.strings) {
        if (!item.prop || !props.has(item.prop)) continue
        out.push(
          finding(
            'D22',
            record.rel,
            item.line,
            `缓存键字面量 ${JSON.stringify(item.value)} 出现在这里：键只许来自 ${source}`,
            `把键写进 ${source}（例如导出一份 keys 对象），这里改成引用它：${item.prop}: keys.xxx`,
          ),
        )
      }
    }
    return out
  },
}

/** D23 路由路径唯一出处 */
export const routePathSingleSource: Rule = {
  id: 'D23',
  domain: 'design',
  level: 'L2',
  severity: 'error',
  title: '路由路径只有一个出处',
  hint: '路径字面量只许出现在声明的唯一出处（`router({ pathSource })`）：路由表、链接与跳转都引用同一份常量',
  requires: ['router.pathSource'],
  run: (ctx) => {
    const source = pathSourceOf(ctx.config)
    // 没声明落点：真跑起来时本规则已被 `requires` 停用；直接调用（自检 / 单测）时也不该报"落点不存在"
    if (!source) return []
    const missing = missingSource(ctx, 'D23', source, '路由路径')
    if (missing) return [missing]
    const props = new Set(pathPropsOf(ctx.config))
    const calls = new Set(navigateCallsOf(ctx.config))
    const out: Finding[] = []
    for (const record of ctx.records) {
      if (record.rel === source) continue
      const facts = ctx.facts.get(record.rel)
      if (!facts) continue
      // ① 路由表 / 链接上的 path、to 属性（`{ path: '/crews' }`、`<Link to="/crews">`）
      for (const item of facts.strings) {
        if (!item.prop || !props.has(item.prop)) continue
        if (!item.value.startsWith('/')) continue
        out.push(
          finding(
            'D23',
            record.rel,
            item.line,
            `路径字面量 ${JSON.stringify(item.value)} 出现在 ${item.prop} 上：路径只许来自 ${source}`,
            `在 ${source} 里声明它（如 paths.crews），这里引用那个常量`,
          ),
        )
      }
      // ② 跳转调用的第一个字符串实参（`navigate('/crews')` / `router.push('/crews')`）
      for (const call of facts.calls) {
        if (!calls.has(call.callee)) continue
        if (!call.stringArg?.startsWith('/')) continue
        out.push(
          finding(
            'D23',
            record.rel,
            call.line,
            `跳转目标字面量 ${JSON.stringify(call.stringArg)} 出现在 ${call.callee}() 上：路径只许来自 ${source}`,
            `在 ${source} 里声明它（如 paths.crews），调用时传那个常量`,
          ),
        )
      }
    }
    return out
  },
}

export const designSourceRules: Rule[] = [cacheKeySingleSource, routePathSingleSource]
