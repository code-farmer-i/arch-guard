import { resolveCallSiteApis } from '../../../engine/call-site-sources.js'
import { globToRegExp } from '../../../engine/util.js'
import type { Finding, Rule, RuleContext } from '../../../engine/types.js'

import { finding } from './design-shared.js'
import {
  analyticsApisOf,
  eventSourceOf,
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
  // 落点可以是**文件路径**或 **glob**（多落点/按域拆键时用 glob）；命中 0 个文件才算"不存在"
  const pattern = globToRegExp(source)
  if ([...presentFilesOf(ctx)].some((rel) => pattern.test(rel))) return null
  return finding(
    rule,
    source,
    1,
    `声明的${what}唯一出处 ${source} 不存在：这一轮没有判"字面量该不该在这里"`,
    '把落点改成一个真实文件的路径；或从适配器里去掉这个声明（没声明时这条规则本来就停用）',
    true,
  )
}

/** "看起来像路径片段"：斜杠后面跟着词字符（`/crews` / `/api/orders`），避免把纯 `/` 或注释当端点 */
const PATH_LIKE = /\/(?=[\w-])/

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
    const sources = queryKeyFromOf(ctx.config)
    // 没声明落点：真跑起来时本规则已被 `requires` 停用；直接调用（自检 / 单测）时也不该报"落点不存在"
    if (sources.length === 0) return []
    const missing = sources
      .map((source) => missingSource(ctx, 'D22', source, '缓存键'))
      .filter((item): item is Finding => item !== null)
    if (missing.length > 0) return missing
    const homes = sources.map((source) => globToRegExp(source))
    const listed = sources.join(' 或 ')
    const props = new Set(queryKeyPropsOf(ctx.config))
    const out: Finding[] = []
    for (const record of ctx.records) {
      if (homes.some((pattern) => pattern.test(record.rel))) continue
      const facts = ctx.facts.get(record.rel)
      if (!facts) continue
      for (const item of facts.strings) {
        if (!item.prop || !props.has(item.prop)) continue
        out.push(
          finding(
            'D22',
            record.rel,
            item.line,
            `缓存键字面量 ${JSON.stringify(item.value)} 出现在这里：键只许来自 ${listed}`,
            `把键写进 ${listed}（例如导出一份 keys 对象），这里改成引用它：${item.prop}: keys.xxx`,
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

/* ---------------- D24 埋点事件名只有一个出处 ---------------- */

const calledApi = (callee: string, apis: string[]): string | null =>
  apis.find((api) => callee === api || callee.endsWith(`.${api}`)) ?? null

/**
 * 判据：把**事件名字符串直接传给埋点调用**（`track('crews_view')`）即报 ——
 * 事件名只许出现在声明的事件表里（`export const EVENTS = { crewsView: 'crews_view' }`），
 * 调用点传常量（`track(EVENTS.crewsView)`）就看不见字面量、自然合规。
 *
 * 为什么需要：与缓存键（D22）/ 路由路径（D23）同族 —— 改名漏一处就是**数据断层**，
 * 而分析平台不会报错（它只会安静地少收一个事件）。
 */
export const analyticsEventSingleSource: Rule = {
  id: 'D24',
  domain: 'design',
  level: 'L2',
  severity: 'error',
  title: '埋点事件名只有一个出处',
  hint: '事件名写进声明的事件表，调用点传常量：改名漏一处就是数据断层，分析平台不会报错',
  requires: ['analytics.apis', 'analytics.eventSource'],
  run: (ctx) => {
    const apis = analyticsApisOf(ctx.config)
    const source = eventSourceOf(ctx.config)
    if (apis.length === 0 || source === '') return []
    // 与 D22 / D23 同形：落点写错时只报"落点不存在"，不要拿整个项目的事件名去刷屏
    const missing = missingSource(ctx, 'D24', source, '埋点事件名')
    if (missing) return [missing]
    const out: Finding[] = []
    for (const record of ctx.records) {
      if (record.rel === source) continue // 事件表本身放的就是这些字面量
      const facts = ctx.facts.get(record.rel)
      if (!facts) continue
      for (const call of facts.calls) {
        const api = calledApi(call.callee, apis)
        if (!api || call.stringArg === undefined) continue
        out.push(
          finding(
            'D24',
            record.rel,
            call.line,
            `埋点事件名直接写字面量：${call.callee}(${JSON.stringify(call.stringArg)})`,
            `从 ${source} 的常量表里取（改名时才只有一处要改）`,
          ),
        )
      }
    }
    return out
  },
}

/* ---------------- D29 权限点只有一个出处 ---------------- */

/**
 * 判据：**判权限点的调用**（`permissions({ apis })` 声明，如 `can`）里出现**字面量权限点**即报 ——
 * 权限点名字只许写进声明的表里。
 *
 * 与 R-46（S38 `callSites`）的分工：那条管"权限**判断**写在哪儿"（只许出现在守卫里），
 * 这条管"权限**点叫什么、在哪儿定义**"。两件事，各一条 —— 合成一条报告说不清哪半在跑。
 */
export const permissionPointSingleSource: Rule = {
  id: 'D29',
  domain: 'design',
  level: 'L2',
  severity: 'error',
  title: '权限点只有一个出处',
  hint: '权限点写进声明的表，调用点传常量：加一个点 / 改一次命名漏一处就是越权或功能消失',
  requires: ['permissions.apis', 'permissions.source'],
  run: (ctx) => {
    const face = ctx.config.adapters.permissions as { apis?: string[]; source?: string } | undefined
    const apis = face?.apis ?? []
    const source = face?.source ?? ''
    if (apis.length === 0 || source === '') return []
    // 与 D22–D24 同形：落点写错时只报"落点不存在"，不要拿整个项目的权限点去刷屏
    const missing = missingSource(ctx, 'D29', source, '权限点')
    if (missing) return [missing]
    const out: Finding[] = []
    for (const record of ctx.records) {
      if (record.rel === source) continue // 表本身放的就是这些字面量
      const facts = ctx.facts.get(record.rel)
      if (!facts) continue
      for (const call of facts.calls) {
        const api = calledApi(call.callee, apis)
        if (!api || call.stringArg === undefined) continue
        out.push(
          finding(
            'D29',
            record.rel,
            call.line,
            `权限点直接写字面量：${call.callee}(${JSON.stringify(call.stringArg)})`,
            `从 ${source} 的常量表里取（改名时才只有一处要改）`,
          ),
        )
      }
    }
    return out
  },
}

/* ---------------- D30 失败处理的策略只有一个出处 ---------------- */

/**
 * 判据：属性名命中**失败处理策略名单**、值又是**函数**（`retry: (n) => n < 3`）或**字符串枚举**
 * （`backoff: 'exponential'`）时，它只许出现在声明的策略落点里。
 *
 * 与 D20 的分工（**同一处不会两条都报**）：数字型策略（`retry: 3` / `staleTime: 60_000`）归
 * `numberHomes`；这条只吃 D20 看不见的那两半 —— **函数体里藏着的口径**（属性名透传进函数体就断，
 * 数也就没了名字）与**根本不是数字的枚举**。一次后端抖动变成"N 个并发 × 各自的重试"，靠这条兜。
 */
export const failurePolicySingleSource: Rule = {
  id: 'D30',
  domain: 'design',
  level: 'L2',
  severity: 'error',
  title: '失败处理的策略只有一个出处',
  hint: '重试 / 退避 / 条件重试写成函数或枚举就只许出现在声明的策略落点（数字型归 numberHomes 管）',
  requires: ['errorPolicy.policyIn'],
  run: (ctx) => {
    const face = ctx.config.adapters['error-policy'] as
      { policyIn?: string[]; policyProps?: string[] } | undefined
    const globs = face?.policyIn ?? []
    if (globs.length === 0) return []
    // 名字优先级：这条面自己给的 → 数据层 kit 给的（库的事实，宿主不必抄）
    const kitProps = (ctx.config.adapters['data-layer'] as { policyProps?: string[] } | undefined)
      ?.policyProps
    const props = new Set(face?.policyProps ?? kitProps ?? [])
    if (props.size === 0) return []
    const patterns = globs.map((glob) => globToRegExp(glob))
    const out: Finding[] = []
    for (const record of ctx.records) {
      if (record.role === 'test' || /\.(test|spec)\./.test(record.rel)) continue
      if (patterns.some((pattern) => pattern.test(record.rel))) continue
      const facts = ctx.facts.get(record.rel)
      if (!facts) continue
      for (const fn of facts.functions) {
        if (!fn.ownedProp || !props.has(fn.ownedProp)) continue
        // **必须收窄**：`retry` 这类名字会撞（UI 回调、i18n 的文案键都叫过 retry）——
        // 只判"策略对象作为调用实参"（`useQuery({ retry: … })`）这一种形态，宁少报不误伤
        if (fn.inCall === undefined) continue
        out.push(
          finding(
            'D30',
            record.rel,
            fn.line,
            `${fn.ownedProp} 写成了函数型策略，却在家外：函数体里的口径（次数 / 退避 / 条件）别人看不见`,
            `把整段策略搬进声明的落点（${globs.join(' / ')}），这里只引用它`,
          ),
        )
      }
      for (const item of facts.strings) {
        if (!item.prop || !props.has(item.prop)) continue
        if (item.inCall === undefined) continue // 同上：只判调用实参里的策略对象
        out.push(
          finding(
            'D30',
            record.rel,
            item.line,
            `${item.prop} 写成了枚举型策略（${JSON.stringify(item.value)}），却在家外`,
            `值进声明的落点（${globs.join(' / ')}），这里只引用常量`,
          ),
        )
      }
    }
    return out
  },
}

/* ---------------- D25 后端端点只有一个出处 ---------------- */

/**
 * 判据：**打后端的调用**（`endpoints({ apis })` 声明，如 `fetch`）的实参里出现**路径字面量**
 * （`/crews`、`/api/orders/:id`）→ 只许出现在声明的出处文件里。
 *
 * 为什么单列一条：端点以前是"事实模型里的隐形人"—— 它多写在模板串里
 * （`` fetch(`${API_BASE_URL}/crews?limit=${n}`) ``），而模板串的静态前缀常常为空、`strings` 只收纯字面量，
 * 于是"改接口漏一处 = 404"这类问题一条规则都管不到（D22/D23/D24 管键、路由、事件名）。
 * 事实模型为此扩了 `calls[].templateParts`（全部静态段）。
 */
export const endpointSingleSource: Rule = {
  id: 'D25',
  domain: 'design',
  level: 'L2',
  severity: 'error',
  title: '后端端点只有一个出处',
  hint: '端点只许来自声明的唯一出处（`endpoints({ source })`）；散着拼，改接口时漏一处就是 404',
  requires: ['endpoints.source'],
  run: (ctx) => {
    const faces = ctx.config.adapters.endpoints as
      { apis?: string[]; from?: string; source?: string } | undefined
    // `apis` 可以直接列，也可以 `from` 从来源表取（`callSiteSources.platform.network`）
    const apis = resolveCallSiteApis(ctx.config, {
      ...(faces?.apis ? { apis: faces.apis } : {}),
      ...(faces?.from ? { from: faces.from } : {}),
    })
    const source = faces?.source ?? ''
    if (apis.length === 0 || source === '') return []
    const missing = missingSource(ctx, 'D25', source, '端点')
    if (missing) return [missing]
    const out: Finding[] = []
    for (const record of ctx.records) {
      if (record.rel === source) continue
      const facts = ctx.facts.get(record.rel)
      if (!facts) continue
      for (const call of facts.calls) {
        const hit = apis.find((api) => call.callee === api || call.callee.endsWith(`.${api}`))
        if (!hit) continue
        const candidates = [
          ...(call.stringArg !== undefined ? [{ text: call.stringArg, line: call.line }] : []),
          ...(call.templateParts ?? []).map((part) => ({ text: part, line: call.line })),
        ]
        for (const candidate of candidates) {
          if (!PATH_LIKE.test(candidate.text)) continue
          out.push(
            finding(
              'D25',
              record.rel,
              candidate.line,
              `端点路径字面量 ${JSON.stringify(candidate.text)} 出现在 ${hit}() 的实参里：只许来自 ${source}`,
              `把端点写进 ${source}（例如导出一份 ENDPOINTS 表），这里改成拼常量：\`${'$'}{API_BASE_URL}${'$'}{ENDPOINTS.xxx}\``,
            ),
          )
        }
      }
    }
    return out
  },
}

/* ---------------- D26 缓存键形状一致 ---------------- */

/** 键字面量必须以声明的前缀开头；同一个"键工厂"里的键**前缀必须一致**，否则 invalidate 失效 */

/**
 * 判据：同一个 key 工厂（`export const crewKeys = { … }`）里，各键数组的**首元素**必须相同。
 *
 * 为什么单列一条：D22 只管"字面量在不在家"，管不了形状 —— `list: ['crews']` 与
 * `detail: (id) => ['crews', 'detail', id]` 混用时，`invalidateQueries({ queryKey: ['crews'] })`
 * **前缀不匹配**，缓存不失效、数据不刷新，而门禁一路绿。
 * 事实模型为此扩了 `strings[].arrayPath`（数组首元素的"键工厂 + 属性"坐标）。
 */
export const keyShapeConsistent: Rule = {
  id: 'D26',
  domain: 'design',
  level: 'L2',
  severity: 'error',
  title: '缓存键形状一致',
  hint: '同一个键工厂里的键要以同一前缀开头，否则 invalidate 前缀匹配不上（缓存不失效）',
  requires: ['dataLayer.queryKeyFrom'],
  run: (ctx) => {
    const sources = queryKeyFromOf(ctx.config)
    if (sources.length === 0) return []
    const missing = sources
      .map((source) => missingSource(ctx, 'D26', source, '缓存键'))
      .filter((item): item is Finding => item !== null)
    if (missing.length > 0) return missing
    const homes = sources.map((source) => globToRegExp(source))
    const out: Finding[] = []
    for (const record of ctx.records) {
      if (!homes.some((pattern) => pattern.test(record.rel))) continue
      const facts = ctx.facts.get(record.rel)
      if (!facts) continue
      // 按"键工厂"分组：`crewKeys.list` / `crewKeys.detail` → 同一组
      const byFactory = new Map<string, { head: string; line: number }[]>()
      for (const item of facts.strings) {
        if (!item.arrayPath) continue
        const dot = item.arrayPath.indexOf('.')
        const factory = dot === -1 ? item.arrayPath : item.arrayPath.slice(0, dot)
        const list = byFactory.get(factory) ?? []
        list.push({ head: item.value, line: item.line })
        byFactory.set(factory, list)
      }
      for (const [factory, heads] of byFactory) {
        const distinct = [...new Set(heads.map((item) => item.head))]
        if (distinct.length <= 1) continue
        // 多数派为准，指出少数派（读起来最省事）
        const counts = new Map<string, number>()
        for (const item of heads) counts.set(item.head, (counts.get(item.head) ?? 0) + 1)
        const majority = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? distinct[0]
        for (const item of heads) {
          if (item.head === majority) continue
          out.push(
            finding(
              'D26',
              record.rel,
              item.line,
              `${factory} 里的键前缀不一致：这里是 ${JSON.stringify(item.head)}，同组多数是 ${JSON.stringify(majority)}`,
              `同一键工厂用同一前缀（invalidate 按前缀匹配：不一致就会"改了不生效"）`,
            ),
          )
        }
      }
    }
    return out
  },
}

export const designSourceRules: Rule[] = [
  cacheKeySingleSource,
  permissionPointSingleSource,
  failurePolicySingleSource,
  keyShapeConsistent,
  endpointSingleSource,
  routePathSingleSource,
  analyticsEventSingleSource,
]
