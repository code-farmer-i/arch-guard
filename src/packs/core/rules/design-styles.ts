import { parseCss } from '../../../engine/css.js'
import type { Finding, Rule } from '../../../engine/types.js'

import { cssValueFamilies } from '../../../data/css-value-families.js'
import { cssFiles, designParams, finding } from './design-shared.js'
import { isModuleStyle, modulePatternsOf } from './face-forms.js'

/**
 * 设计系统域·样式纪律（D12–D18）：魔法数字三族、内联样式、样式落点、CSS Module 契约、语义令牌。
 */

/* ---------------- D16 自研样式只在组件样式文件（默认 *.module.css） ---------------- */

export const stylesInModules: Rule = {
  id: 'D16',
  domain: 'design',
  requires: ['designSystem.styleDir'],
  level: 'L1',
  severity: 'error',
  title: '自研样式只在组件样式文件',
  hint: '全局 CSS 只放令牌与第三方覆盖；组件样式一律走方案声明的组件样式文件（默认 *.module.css），避免类名互相污染',
  run: (ctx) => {
    const params = designParams(ctx)
    /**
     * **组件样式文件的形态来自方案面**（`styles.modulePatterns`，默认 `*.module.css`）。
     * 空清单 = 这套方案没有组件样式文件（Tailwind / CSS-in-JS）—— 那时"全局 CSS 该放哪"
     * 没有判据，这里不猜也不误报；宿主若要连规则本身也从报告里去掉，在配置里 `disable: ['D16']`。
     */
    const patterns = modulePatternsOf(ctx.config)
    if (patterns.length === 0) return []
    /**
     * 全局 CSS 允许的落点 = **声明过的**样式目录 / 令牌目录 / 第三方覆盖目录。
     * 三个都要收：FSD 的令牌在 `shared/ui/styles/tokens`、第三方覆盖在 `shared/ui/styles/vendor`，
     * 而全局样式（reset / 变量）属于官方 `app/styles` 片段 —— 只认 `styleDir` 一个目录时，
     * `app/styles/*.css` 会被误报成「出现在组件目录」（文案与事实都不对）。
     */
    const globalDirs = [params.styleDir, params.tokenDir, params.vendorDir].filter(
      (dir) => typeof dir === 'string' && dir.length > 0,
    )
    return ctx.records
      .filter((record) => record.kind === 'css')
      .filter((record) => !isModuleStyle(record.rel, patterns))
      .filter((record) => !globalDirs.some((dir) => record.rel.startsWith(`${dir}/`)))
      .map((record) =>
        finding(
          'D16',
          record.rel,
          1,
          `全局 CSS 只许放声明的样式落点（${globalDirs.join(' / ') || '未声明'}）；` +
            `组件样式请用方案声明的组件样式文件（${patterns.join(' / ')}）`,
        ),
      )
  },
}

/* ---------------- D17 CSS Module 双向契约 ---------------- */

/** 从选择器文本里抠出类名 */
const classesInSelector = (selector: string): string[] =>
  [...selector.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map((match) => match[1] as string)

export const cssModuleContract: Rule = {
  id: 'D17',
  domain: 'design',
  level: 'L2',
  severity: 'error',
  title: 'CSS Module 双向契约',
  hint: 'styles.X 必须有定义、定义的类必须被用到；删组件时别忘了同一份样式',
  run: (ctx) => {
    const out: Finding[] = []
    // 双向契约只对**方案声明的组件样式文件**成立（默认 *.module.css；空清单 = 没有这种文件）
    const patterns = modulePatternsOf(ctx.config)
    if (patterns.length === 0) return out
    const records = ctx.records.filter((record) => record.kind === 'ts' || record.kind === 'css')
    const byRel = new Map(records.map((record) => [record.rel, record]))

    for (const record of records) {
      if (!isModuleStyle(record.rel, patterns)) continue
      const text = ctx.sourceOf(record.rel) ?? ''
      const defined = new Set<string>()
      for (const rule of parseCss(record.rel, text).rules) {
        for (const name of classesInSelector(rule.selector)) defined.add(name)
      }
      // 谁 import 了这份样式
      const users = [...(ctx.graph.importers.get(record.rel) ?? [])].filter(
        (rel) => byRel.get(rel)?.kind === 'ts',
      )
      if (users.length === 0) {
        out.push(finding('D17', record.rel, 1, '没有任何组件 import 这份样式'))
        continue
      }
      const referenced = new Set<string>()
      for (const user of users) {
        const source = ctx.sourceOf(user) ?? ''
        const alias = source.match(
          new RegExp(`import\\s+(\\w+)\\s+from\\s+['"][^'"]*${record.rel.split('/').pop()}['"]`),
        )
        const name = alias?.[1] ?? 'styles'
        for (const match of source.matchAll(new RegExp(`${name}\\.([a-zA-Z_][\\w-]*)`, 'g'))) {
          referenced.add(match[1] as string)
        }
        for (const match of source.matchAll(new RegExp(`${name}\\[['"]([^'"]+)['"]\\]`, 'g'))) {
          referenced.add(match[1] as string)
        }
      }
      for (const name of referenced) {
        if (!defined.has(name))
          out.push(finding('D17', record.rel, 1, `组件用了未定义的类：${name}`))
      }
      for (const name of defined) {
        if (!referenced.has(name))
          out.push(finding('D17', record.rel, 1, `定义的类没人用：${name}`))
      }
    }
    return out
  },
}

/* ---------------- D18 组件样式只消费语义令牌 ---------------- */

/**
 * 判据：**组件样式文件**里引用静态令牌（`var(--sh-static-*)`）即报 —— 该走语义令牌。
 *
 * 为什么需要：组件直接引底层静态值，换主题 / 换品牌色时那一处不跟着变（语义层被绕过）。
 * 只判组件样式文件（形态由方案面声明）；全局样式与 vendor 覆盖不在其列。
 */
export const componentsUseSemanticTokens: Rule = {
  id: 'D18',
  domain: 'design',
  requires: ['designSystem.staticPrefix'],
  level: 'L1',
  severity: 'error',
  title: '组件样式只消费语义令牌',
  hint: '组件样式里用语义令牌（如 var(--brand)），别直接引色板里的静态值 —— 换主题时它不会跟着变',
  run: (ctx) => {
    const prefix = ctx.config.params.staticPrefix
    if (typeof prefix !== 'string' || prefix === '') return []
    const patterns = modulePatternsOf(ctx.config)
    if (patterns.length === 0) return []
    const out: Finding[] = []
    for (const file of cssFiles(ctx)) {
      if (!isModuleStyle(file.rel, patterns)) continue
      for (const ref of file.varRefs) {
        if (!ref.name.startsWith(prefix)) continue
        out.push(
          finding(
            'D18',
            file.rel,
            ref.line,
            `组件样式引用了静态令牌 ${ref.name}：该用语义令牌`,
            '语义令牌在主题文件里（明暗两套），静态值只属于色板',
          ),
        )
      }
    }
    return out
  },
}

/* ---------------- D09 禁 !important ---------------- */

/**
 * 判据：样式里出现 `!important`，且文件不在**声明的 vendor 目录**里。
 *
 * 为什么需要（原委派给 stylelint `declaration-no-important`）：第三方覆盖确实需要 `!important`，
 * 但它必须是"覆盖"（vendor 目录），不该长在自家组件样式里 —— 一旦开了头，后面的人只能加更强的。
 * 委派出去时那条规则要项目自己开；而 vendor 目录是我们**已经知道**的事实（适配表 + params）。
 */
export const noImportant: Rule = {
  id: 'D09',
  domain: 'design',
  requires: ['designSystem.vendorDir'],
  level: 'L1',
  severity: 'error',
  title: '禁 !important',
  hint: '覆盖第三方样式才用 !important，而且只写在 vendor 目录里；自家组件样式该改层级就别硬压',
  run: (ctx) => {
    const params = designParams(ctx)
    const out: Finding[] = []
    for (const file of cssFiles(ctx)) {
      if (file.rel.startsWith(`${params.vendorDir}/`)) continue
      for (const block of file.rules) {
        for (const declaration of block.declarations) {
          if (!/!\s*important/i.test(declaration.value)) continue
          out.push(
            finding(
              'D09',
              file.rel,
              declaration.line,
              `${declaration.prop} 用了 !important：只许写在 vendor 目录里（第三方覆盖）`,
              '改层级 / 加语义类，而不是加更强的 !important',
            ),
          )
        }
      }
    }
    return out
  },
}

/* ---------------- D12 / D13 / D14 数值三族的白名单 ---------------- */

/** 从一个声明值里取出该族的数值（`margin: 13px 4px` → ['13px','4px']） */
const numericTokens = (value: string, units: string[]): string[] =>
  value
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => {
      if (token === '') return false
      if (units.length === 0) return /^-?\d+$/.test(token)
      return new RegExp(`^-?\\d*\\.?\\d+(?:${units.join('|')})$`).test(token)
    })

interface ValueWhitelist {
  rule: string
  allow: string[]
}

const whitelistOf = (
  ctx: { config: { params: Record<string, unknown> } },
  rule: string,
): string[] | null => {
  const lists = (ctx.config.params.valueWhitelists as ValueWhitelist[] | undefined) ?? []
  const found = lists.find((item) => item.rule === rule)
  return found && found.allow.length > 0 ? found.allow : null
}

const valueFamilyRules: Rule[] = cssValueFamilies.map((family) => ({
  id: family.rule,
  domain: 'design',
  level: 'L1',
  severity: 'error',
  title: `${family.title}必须走声明的刻度`,
  hint: family.hint,
  requires: ['designSystem.styleDir'],
  run: (ctx) => {
    const allow = whitelistOf(ctx, family.rule)
    if (allow === null) return [] // 声明才判
    const allowed = new Set(allow)
    const out: Finding[] = []
    for (const file of cssFiles(ctx)) {
      for (const block of file.rules) {
        for (const declaration of block.declarations) {
          const prop = declaration.prop.replace(/^--/, '')
          if (
            !family.properties.some((prefix) => prop === prefix || prop.startsWith(`${prefix}-`))
          ) {
            continue
          }
          for (const token of numericTokens(declaration.value, family.units)) {
            if (token === '0' || allowed.has(token)) continue
            out.push(
              finding(
                family.rule,
                file.rel,
                declaration.line,
                `${declaration.prop}: ${token} 不在${family.title}的刻度里（允许：${allow.join(' / ')}）`,
                family.hint,
              ),
            )
          }
        }
      }
    }
    return out
  },
}))

export const designStyleRules: Rule[] = [
  // 数值三族（D12–D14）由数据表 + 项目声明的白名单驱动（0.4.0 收回本体）
  ...valueFamilyRules,
  stylesInModules,
  cssModuleContract,
  noImportant,
  componentsUseSemanticTokens,
]
