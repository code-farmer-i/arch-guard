import { DEFAULT_MODULE_PATTERNS, DEFAULT_ROUTE_FILES } from '../../../data/face-forms.js'
import type { Config, RouterAdapter, StylesAdapter } from '../../../engine/types.js'

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
