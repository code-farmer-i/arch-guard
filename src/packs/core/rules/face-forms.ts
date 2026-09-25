import {
  DEFAULT_MODULE_PATTERNS,
  DEFAULT_NAVIGATE_CALLS,
  DEFAULT_PATH_PROPS,
  DEFAULT_QUERY_KEY_PROPS,
  DEFAULT_ROUTE_FILES,
} from '../../../data/face-forms.js'
import type {
  Config,
  DataLayerAdapter,
  RouterAdapter,
  StylesAdapter,
} from '../../../engine/types.js'

/** 埋点面（由 `analytics()` 预设登记）：埋点调用名 + 事件名的唯一出处 */
interface AnalyticsAdapter {
  facet: string
  apis?: string[]
  eventSource?: string
}

/** **埋点调用名**（D24）：项目声明（`analytics({ apis })`）。空 = 停用 */
export function analyticsApisOf(config: Config): string[] {
  return adapterOf<AnalyticsAdapter>(config, 'analytics')?.apis ?? []
}

/** **事件名的唯一出处**（D24，文件路径）：项目声明；空 = 停用 */
export function eventSourceOf(config: Config): string {
  return adapterOf<AnalyticsAdapter>(config, 'analytics')?.eventSource ?? ''
}

/** 调用落点面（由 `callSites()` 预设登记）：一组组"哪些调用 + 只许出现在哪" */
export interface CallSiteGroup {
  name: string
  apis: string[]
  in: string[]
}
interface CallSitesAdapter {
  facet: string
  groups?: CallSiteGroup[]
}

/**
 * **方案面形态**的唯一读取处：域的公开面入口文件名（router 面）与组件样式文件形态（styles 面）。
 *
 * 为什么单列一个模块：这两处词汇以前**写死在规则里**（`routes.tsx` / `.module.css`），
 * 而范式的角色表写的是 `routes.{ts,tsx}` —— 两边一漂，入口叫 `routes.ts` 的域就被
 * S04 / S05 / S15 误报成「跨域引用内部文件」「view 没被本域 routes 引用」。
 * 现在规则只问这里，默认值来自 `src/data/face-forms.ts`，适配器声明了就盖过它。
 */

const adapterOf = <T extends { facet: string }>(config: Config, facet: string): T | undefined =>
  Object.values(config.adapters).find((item) => item.facet === facet) as T | undefined

/**
 * 域的**公开面入口**文件名（默认 `routes.{ts,tsx}`，见 `data/face-forms.ts`）。
 *
 * 返回 `[]` 是**有意义的声明**（路由由目录约定产生：没有 per-domain 出口文件），
 * 不是"没配"—— 依赖它的规则据此**不判**；调用方别把 `[]` 当缺省再套一层默认值。
 */
export function routeFilesOf(config: Config): string[] {
  return adapterOf<RouterAdapter>(config, 'router')?.routeFiles ?? DEFAULT_ROUTE_FILES
}

/** 域 `domain` 的公开面入口路径清单（`modules/<域>/routes.{ts,tsx}`） */
export function routeEntriesOf(config: Config, domain: string): string[] {
  const modulesRoot = config.layout.modules
  return routeFilesOf(config).map((file) => `${modulesRoot}/${domain}/${file}`)
}

/**
 * **组件样式**文件形态（默认 `*.module.css`）。
 * `[]` = 这套方案没有组件样式文件（Tailwind / CSS-in-JS / 原子类）→ D16 / D17 不判。
 */
export function modulePatternsOf(config: Config): string[] {
  return adapterOf<StylesAdapter>(config, 'styles')?.modulePatterns ?? DEFAULT_MODULE_PATTERNS
}

/**
 * **缓存键的唯一出处**（D22 的落点）。空串 = 没声明 → 依赖它的规则由 `requires` 明列停用。
 */
export function queryKeyFromOf(config: Config): string {
  return adapterOf<DataLayerAdapter>(config, 'data-layer')?.queryKeyFrom ?? ''
}

/** 缓存键挂在哪几个属性上（默认 `['queryKey']`） */
export function queryKeyPropsOf(config: Config): string[] {
  return adapterOf<DataLayerAdapter>(config, 'data-layer')?.queryKeyProps ?? DEFAULT_QUERY_KEY_PROPS
}

/**
 * **路由路径的唯一出处**（D23 的落点）。空串 = 没声明 → D23 明列停用。
 */
export function pathSourceOf(config: Config): string {
  return adapterOf<RouterAdapter>(config, 'router')?.pathSource ?? ''
}

/** 承载路由路径的属性名（默认 `['path','to']`） */
export function pathPropsOf(config: Config): string[] {
  return adapterOf<RouterAdapter>(config, 'router')?.pathProps ?? DEFAULT_PATH_PROPS
}

/** 触发跳转的调用名（默认 `navigate` / `router.push`…） */
export function navigateCallsOf(config: Config): string[] {
  return adapterOf<RouterAdapter>(config, 'router')?.navigateCalls ?? DEFAULT_NAVIGATE_CALLS
}

/**
 * **取数 API 名**（S36）：由 kit 按方案声明（`useQuery` / `useMutation`…）。
 * 空清单 = 没声明 → S36 明列停用（不猜"什么算取数"）。
 */
export function fetchApisOf(config: Config): string[] {
  return adapterOf<DataLayerAdapter>(config, 'data-layer')?.fetchApis ?? []
}

/** **取数只许出现的落点**（S36，glob 列表）：项目决定，空 = 停用 */
export function fetchInOf(config: Config): string[] {
  return adapterOf<DataLayerAdapter>(config, 'data-layer')?.fetchIn ?? []
}

/**
 * **调用落点**的声明组（S38）：每组 = 一类调用（`apis`）+ 只许出现的落点（`in`）。
 * 空 = 停用（不猜"什么算副作用 / 什么算配置对象"）。
 */
export function callSiteGroupsOf(config: Config): CallSiteGroup[] {
  return adapterOf<CallSitesAdapter>(config, 'call-sites')?.groups ?? []
}

const regexCache = new Map<string, RegExp>()

/**
 * 编译并缓存正则。`defineAdapter` 已经校验过可编译；raw `overrides.adapters` 里写歪的会以
 * **规则异常**（fail-closed → 报告里明列）出现，而不是静默当成"没有样式文件"。
 */
export function patternRegex(pattern: string): RegExp {
  const cached = regexCache.get(pattern)
  if (cached) return cached
  const compiled = new RegExp(pattern)
  regexCache.set(pattern, compiled)
  return compiled
}

/** `rel` 是不是**这套方案**的组件样式文件 */
export function isModuleStyle(rel: string, patterns: string[]): boolean {
  return patterns.some((pattern) => patternRegex(pattern).test(rel))
}

/**
 * 契约扫描域里的**全部**源文件（含没命中任何角色的那些）。
 *
 * 判"某个文件在不在"必须用它，不能只看 `ctx.records` —— records 只装**命中角色**的文件：
 * 自定义过入口名的方案（入口叫 `entry.ts` 而角色表里没有它）下，入口文件落在 `scan.missing` 里，
 * 只看 records 会得出"域里没有入口"的结论 → 假阳性（S14）与静默漏报（S15②③）。
 *
 * 取并集而不是只读 `ctx.files`：规则单测会手搓部分 context，两条来源都兜住更稳。
 */
export function presentFilesOf(ctx: {
  files?: string[]
  records: { rel: string }[]
  scan?: { missing?: string[]; ambiguous?: { rel: string }[] }
}): Set<string> {
  return new Set([
    ...(ctx.files ?? []),
    ...ctx.records.map((record) => record.rel),
    ...(ctx.scan?.missing ?? []),
    ...(ctx.scan?.ambiguous?.map((entry) => entry.rel) ?? []),
  ])
}
