import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { parseCss } from '../../../engine/css.js'
import type { Facts, RuleContext } from '../../../engine/types.js'

export interface ContrastPair {
  fg: string
  bg: string
  /** bg 是半透明柔底时，压在哪个底色上算 */
  parent?: string
  usage: string
  min: number
}

/** 令牌前缀（`--sh-*`）曾在这里作为参数 —— 但**没有任何规则读它**（D02/D18 未实现），
 * 而且是宿主 superhive 的前缀，不该做通用默认。删掉；将来实现 D02/D18 时再作为
 * `designSystem({ tokenPrefix })` + `requires: ['designSystem.tokenPrefix']` 加回。 */
/**
 * 设计系统的**项目事实**。落点（`styleDir` / `tokenDir` / `vendorDir` / `paletteFile` /
 * `themeFile` / `storageFile`）**不设兜底默认**：它们由范式声明（`canonical()` / `fsd()` → `params`）
 * 或项目显式给（`designSystem({ … })`）；缺了就由 `requires: ['designSystem.<字段>']` 让依赖它的规则
 * **明列停用** —— 而不是悄悄用三根范式的路径去量一个不存在的目录。
 *
 * `spacing` / `lengthProps` / `allowLengthValues` 曾在这里，但**没有任何规则读**（D12–D14 魔法数字族未实现、
 * 已委派 stylelint/eslint）—— 按"声明必须有消费者"删掉，实现时再加回。
 */
export interface DesignParams {
  themes: string[]
  styleDir: string
  tokenDir: string
  vendorDir: string
  paletteFile: string
  themeFile: string
  storageFile: string
  htmlKeys: string[]
  contrastPairs: ContrastPair[]
}

const DEFAULTS: Pick<DesignParams, 'themes' | 'htmlKeys'> = {
  themes: ['dark', 'light'],
  htmlKeys: ['theme'],
}

/**
 * 解析设计系统参数：**项目在 `designSystem()` 里写的值必须盖过默认值**。
 *
 * 这里曾经只展开 `DEFAULTS`、没把 `ctx.config.params` 里的路径盖上去，于是
 * `tokenPrefix` / `spacing` / `styleDir` / `tokenDir` / `vendorDir` / `paletteFile` /
 * `themeFile` / `storageFile` 八个字段的配置**全部被静默忽略**：规则照默认路径去找，
 * 什么也找不到，还显示"通过"。字段逐条列出而不是 `...params`，是为了让这份可配清单可见 ——
 * 顺带避免把 `params` 里别的键（deps 的 allow / capabilities、maxDepth 等）漏进 DesignParams。
 */
export function designParams(ctx: RuleContext): DesignParams {
  const p = ctx.config.params as Partial<DesignParams>
  return {
    // 落点：只认项目/范式声明过的（缺了就是空串，而依赖它的规则已被能力协商停用）
    styleDir: p.styleDir ?? '',
    tokenDir: p.tokenDir ?? '',
    vendorDir: p.vendorDir ?? '',
    paletteFile: p.paletteFile ?? '',
    themeFile: p.themeFile ?? '',
    storageFile: p.storageFile ?? '',
    // 约定（可覆盖）：明暗主题名与 index.html 里的键名
    themes: p.themes ?? DEFAULTS.themes,
    htmlKeys: p.htmlKeys ?? DEFAULTS.htmlKeys,
    contrastPairs: p.contrastPairs ?? [],
  }
}

export { finding, type FindingPosition } from './finding.js'

/** 用事实模型里的注释区间把注释遮罩成空格（避免注释里的示例被误判） */
export function maskTs(text: string, facts: Facts | undefined): string {
  if (!facts || facts.comments.length === 0) return text
  const chars = [...text]
  for (const comment of facts.comments) {
    for (let i = comment.pos; i < comment.end; i += 1) if (chars[i] !== '\n') chars[i] = ' '
  }
  return chars.join('')
}

export interface CssFile {
  rel: string
  text: string
  masked: string
  vars: { name: string; value: string; line: number }[]
  varRefs: { name: string; line: number; hasFallback: boolean }[]
  selectors: { selector: string; line: number }[]
  rules: {
    selector: string
    line: number
    declarations: { prop: string; value: string; line: number }[]
    vars: { name: string; value: string; line: number }[]
  }[]
}

export function cssFiles(ctx: RuleContext): CssFile[] {
  return ctx.records
    .filter((record) => record.kind === 'css')
    .map((record) => {
      const text = ctx.sourceOf(record.rel) ?? ''
      return { ...parseCss(record.rel, text), text, masked: text }
    })
}

/**
 * 适配表声明的 vendor 选择器 / 变量前缀（编译成正则）。
 *
 * **D10 / D10b / P11 共用这一份** —— 曾经各自 `new RegExp(pattern)` 并拿**整份文件文本**去 test，
 * 于是 `vendorVars: ['^--ant-']` 里的 `^`（本意是"变量名开头"）变成了"文件开头"：
 * 变量不在第一行就检测不到 → D10 漏检、P11 误报「零使用」。
 * 匹配必须落在**结构化结果**上：选择器比选择器、变量比变量名（见 `usesVendorPatterns`）。
 */
export function vendorPatterns(ctx: RuleContext): { selectors: RegExp[]; vars: RegExp[] } | null {
  const adapter = Object.values(ctx.config.adapters).find((item) => item.facet === 'ui-kit') as
    { vendorSelectors?: string[]; vendorVars?: string[] } | undefined
  const selectors = (adapter?.vendorSelectors ?? []).map((pattern) => new RegExp(pattern))
  const vars = (adapter?.vendorVars ?? []).map((pattern) => new RegExp(pattern))
  if (selectors.length === 0 && vars.length === 0) return null
  return { selectors, vars }
}

/** 这个 CSS 文件里有没有出现适配表声明的 vendor 选择器 / 变量（定义与引用都算） */
export function usesVendorPatterns(
  file: CssFile,
  patterns: { selectors: RegExp[]; vars: RegExp[] },
): boolean {
  const selectorHit = (selector: string): boolean =>
    patterns.selectors.some((regex) => regex.test(selector))
  const varHit = (name: string): boolean => patterns.vars.some((regex) => regex.test(name))
  return (
    file.selectors.some((item) => selectorHit(item.selector)) ||
    file.vars.some((item) => varHit(item.name)) ||
    file.varRefs.some((item) => varHit(item.name))
  )
}

export const isTokenFile = (rel: string, params: DesignParams): boolean =>
  rel.startsWith(`${params.tokenDir}/`)

/* ---------------- 数值刻度白名单（D12–D14 与 D15 共用） ---------------- */

export interface ValueWhitelist {
  rule: string
  allow: string[]
}

/** 某一族声明的刻度白名单；没声明（或空）→ null = **这一族不判** */
export const whitelistOf = (
  ctx: { config: { params: Record<string, unknown> } },
  rule: string,
): string[] | null => {
  const lists = (ctx.config.params.valueWhitelists as ValueWhitelist[] | undefined) ?? []
  const found = lists.find((item) => item.rule === rule)
  return found && found.allow.length > 0 ? found.allow : null
}

/** 从一个声明值里取出该族的数值（`13px 4px` → ['13px','4px']） */
export const numericTokens = (value: string, units: string[]): string[] =>
  value
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => {
      if (token === '') return false
      if (units.length === 0) return /^-?\d+$/.test(token)
      return new RegExp(`^-?\\d*\\.?\\d+(?:${units.join('|')})$`).test(token)
    })

/** 规则需要读项目里任意文件（如 index.html）时的兜底 */
export function tryRead(ctx: RuleContext, rel: string): string | null {
  const direct = ctx.sourceOf(rel)
  if (direct !== undefined) return direct
  try {
    return readFileSync(join(ctx.config.root, rel), 'utf8')
  } catch {
    return null
  }
}
