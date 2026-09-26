import { parseCss } from '../../../engine/css.js'
import type { Finding, Rule } from '../../../engine/types.js'

import { cssValueFamilies } from '../../../data/css-value-families.js'
import { cssFiles, designParams, finding, numericTokens, whitelistOf } from './design-shared.js'
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
     * 三个都要收：全局样式（reset / 变量）· 设计令牌 · 第三方覆盖常常分在三个子目录里
     * （FSD 预设把三者都放在官方 app 段的 `app/styles` 下）—— 只认 `styleDir` 一个目录时，
     * 子目录里的 CSS 会被误报成「出现在组件目录」（文案与事实都不对）。
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
  level: 'L2',
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
            ref,
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
  level: 'L2',
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
              declaration,
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

const valueFamilyRules: Rule[] = cssValueFamilies.map((family) => ({
  id: family.rule,
  domain: 'design',
  level: 'L2',
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

/* ---------------- D27 对比度组合必须声明过 ---------------- */

/** 从声明值里取出令牌名：`var(--on-brand)` / `var(--on-brand, #fff)` → `--on-brand` */
const tokenOfValue = (value: string): string | null => /var\(\s*(--[\w-]+)/.exec(value)?.[1] ?? null

/**
 * 判据：**组件样式**里同时出现 `color` 与 `background`（同为令牌引用）时，这一对必须出现在
 * `designSystem({ contrastPairs })` 里。
 *
 * 为什么单列一条：D07 只算**声明过的那几对** —— 于是"语义令牌当反色用"
 * （`color: var(--surface)` + `background: var(--brand)`）永远不会被算到：白字橙底只有 3.1:1，
 * 而配置里声明的是 `--text-primary`/`--surface`（必然通过的那一对）。这条负责**发现漏声明**。
 */
export const contrastPairsDeclared: Rule = {
  id: 'D27',
  domain: 'design',
  level: 'L2',
  severity: 'error',
  title: '对比度组合必须声明过',
  hint: '组件里同时写 color 与 background 的令牌组合，要加进 `contrastPairs` —— 否则没人算它俩的对比度',
  requires: ['designSystem.contrastPairs'],
  run: (ctx) => {
    const params = designParams(ctx)
    if (params.contrastPairs.length === 0) return []
    const declared = new Set(params.contrastPairs.map((pair) => `${pair.fg}|${pair.bg}`))
    const globalDirs = [params.styleDir, params.tokenDir, params.vendorDir].filter(
      (dir): dir is string => typeof dir === 'string' && dir.length > 0,
    )
    const out: Finding[] = []
    for (const file of cssFiles(ctx)) {
      if (globalDirs.some((dir) => file.rel.startsWith(`${dir}/`))) continue
      for (const rule of file.rules) {
        const fg = rule.declarations.find((item) => item.prop === 'color')
        const bg = rule.declarations.find(
          (item) => item.prop === 'background' || item.prop === 'background-color',
        )
        if (!fg || !bg) continue
        const fgToken = tokenOfValue(fg.value)
        const bgToken = tokenOfValue(bg.value)
        // 字面量颜色是 D01 的活；这里只管"两个令牌的组合没人算对比度"
        if (!fgToken || !bgToken) continue
        if (declared.has(`${fgToken}|${bgToken}`)) continue
        out.push(
          finding(
            'D27',
            file.rel,
            fg,
            `${fgToken} 叠在 ${bgToken} 上，但这一对没在 contrastPairs 里声明：没人算它们的对比度`,
            `加进 designSystem({ contrastPairs: [{ fg: '${fgToken}', bg: '${bgToken}', usage: '…', min: 4.5 }] })`,
          ),
        )
      }
    }
    return out
  },
}

/* ---------------- D28 声明的样式落点必须有入口 ---------------- */

/**
 * 判据：声明了 `styleDir` / `tokenDir` / `vendorDir` 的目录里，至少要有**一个文件真的被引用**
 * （被 TS/JS import，或被另一份 CSS `@import`）—— 否则那份 CSS 谁也没加载。
 *
 * 为什么单列一条：真实踩过 —— 四份全局 CSS（palette / theme / base / vendor）都在，
 * 但**没有任何入口**：主题静默不生效，而门禁一路绿（各条规则各自都"合规"）。
 */
export const styleEntrypointExists: Rule = {
  id: 'D28',
  domain: 'design',
  level: 'L2',
  severity: 'error',
  title: '声明的样式落点必须有入口',
  hint: '这些 CSS 没有任何引用：谁也不会加载它们（主题不生效却没人报）—— 加一个入口文件并在应用入口 import',
  requires: ['designSystem.styleDir'],
  run: (ctx) => {
    const params = designParams(ctx)
    const dirs = [params.styleDir, params.tokenDir, params.vendorDir].filter(
      (dir): dir is string => typeof dir === 'string' && dir.length > 0,
    )
    const cssFilesIn = cssFiles(ctx)
    const out: Finding[] = []
    for (const dir of dirs) {
      const files = cssFilesIn.filter((file) => file.rel.startsWith(`${dir}/`))
      if (files.length === 0) continue
      /**
       * 「有人从**应用侧**引它」：从目录里的文件沿 `importers` 上溯，直到遇到非 CSS 的引用者。
       * 只看"有没有引用者"是不够的 —— 那几份 CSS 互相 `@import` 也算引用，
       * 于是把应用入口里那一行删掉照样"有引用"（假阴性）。
       */
      const referenced = files.some((file) => {
        const seen = new Set<string>([file.rel])
        const queue = [...(ctx.graph.importers.get(file.rel) ?? [])]
        while (queue.length > 0) {
          const importer = queue.shift() as string
          if (seen.has(importer)) continue
          seen.add(importer)
          if (!importer.endsWith('.css')) return true
          queue.push(...(ctx.graph.importers.get(importer) ?? []))
        }
        return false
      })
      if (referenced) continue
      out.push(
        finding(
          'D28',
          files[0]?.rel ?? dir,
          1,
          `${dir} 下有 ${files.length} 份 CSS，但没有任何引用：不会被加载`,
          '加一个入口（如 styles/index.css 汇总 @import）并在应用入口 import 它',
        ),
      )
    }
    return out
  },
}

export const designStyleRules: Rule[] = [
  contrastPairsDeclared,
  styleEntrypointExists,
  // 数值三族（D12–D14）由数据表 + 项目声明的白名单驱动（0.4.0 收回本体）
  ...valueFamilyRules,
  stylesInModules,
  cssModuleContract,
  noImportant,
  componentsUseSemanticTokens,
]
