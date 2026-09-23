import { fingerprintsOf } from '../../../data/kit-fingerprints.js'
import { contrastRatio, flatten, resolveColor } from '../../../engine/css.js'
import type { Finding, Rule, RuleContext } from '../../../engine/types.js'

import { cssFiles, designParams, finding, isTokenFile, tryRead } from './design-shared.js'

/* ---------------- D07 对比度基线 ---------------- */

export const contrastBaseline: Rule = {
  id: 'D07',
  domain: 'design',
  level: 'L2',
  severity: 'error',
  title: '对比度基线',
  hint: '在 theme.css 调亮/调暗文字色或底色，别让文字糊在背景里',
  run: (ctx) => {
    const params = designParams(ctx)
    if (params.contrastPairs.length === 0) return []
    const files = cssFiles(ctx)
    const themeFile = files.find((item) => item.rel === params.themeFile)
    if (!themeFile) return []
    const primitive = new Map<string, string>()
    for (const file of files) {
      if (!isTokenFile(file.rel, params)) continue
      if (file.rel === params.themeFile) continue
      for (const item of file.vars) primitive.set(item.name, item.value)
    }
    // 默认块（不带主题名的 :root）是两套主题的共同起点
    const defaults = themeFile.rules
      .filter((rule) => !params.themes.some((theme) => rule.selector.includes(theme)))
      .flatMap((rule) => rule.vars)
    const out: Finding[] = []
    for (const theme of params.themes) {
      const vars = new Map(primitive)
      for (const item of defaults) vars.set(item.name, item.value)
      const block = themeFile.rules.find(
        (rule) =>
          rule.selector.includes(`data-theme="${theme}"`) ||
          rule.selector.includes(`data-theme='${theme}'`),
      )
      for (const item of block?.vars ?? []) vars.set(item.name, item.value)
      for (const pair of params.contrastPairs) {
        const fgRaw = resolveColor(vars, pair.fg)
        const bgRaw = resolveColor(vars, pair.bg)
        if (!fgRaw || !bgRaw) continue
        const parent = pair.parent ? resolveColor(vars, pair.parent) : null
        const base =
          bgRaw.alpha >= 1
            ? bgRaw.rgb
            : flatten(bgRaw, parent && parent.alpha >= 1 ? parent.rgb : [255, 255, 255])
        const fg = flatten(fgRaw, base)
        const ratio = contrastRatio(fg, base)
        if (ratio + 1e-9 < pair.min) {
          out.push(
            finding(
              'D07',
              themeFile.rel,
              1,
              `[${theme}] ${pair.usage} 对比度 ${ratio.toFixed(2)}:1 < ${pair.min}`,
            ),
          )
        }
      }
    }
    return out
  },
}

/* ---------------- D08 storage key 与 index.html 一致 ---------------- */

export const storageKeyTwins: Rule = {
  id: 'D08',
  domain: 'design',
  level: 'L2',
  severity: 'error',
  title: 'storage key 与 index.html 一致',
  hint: 'index.html 的内联脚本要在 JS 加载前写 data-theme，key 必须与 STORAGE_KEYS 一致',
  run: (ctx) => {
    const params = designParams(ctx)
    const storageText = ctx.sourceOf(params.storageFile) ?? tryRead(ctx, params.storageFile)
    const html = tryRead(ctx, 'index.html')
    if (!storageText || html === null) return []
    const out: Finding[] = []
    for (const key of params.htmlKeys) {
      const match = storageText.match(new RegExp(`${key}\\s*:\\s*'([^']+)'`))
      if (!match) {
        out.push(finding('D08', params.storageFile, 1, `STORAGE_KEYS 里找不到 ${key}`))
        continue
      }
      const value = match[1] as string
      if (!html.includes(value)) {
        out.push(finding('D08', 'index.html', 1, `index.html 未使用 ${key} 的 key：${value}`))
      }
    }
    return out
  },
}

/* ---------------- D09 禁 !important ---------------- */

export const noImportant: Rule = {
  id: 'D09',
  domain: 'design',
  level: 'L2',
  severity: 'error',
  title: '禁 !important',
  hint: '覆盖不动先查组件 token 是否有对应变量；!important 会把层叠关系彻底搞死',
  run: (ctx) =>
    ctx.records
      .filter((record) => record.kind === 'css')
      .flatMap((record) => {
        const text = ctx.sourceOf(record.rel) ?? ''
        const masked = text.replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '))
        return masked
          .split('\n')
          .map((line, index) => ({ line: index + 1, text: line }))
          .filter((item) => /!important/.test(item.text))
          .map((item) =>
            finding('D09', record.rel, item.line, `!important：${item.text.trim().slice(0, 40)}`),
          )
      }),
}

/* ---------------- D10 / D10b vendor 边界 ---------------- */

function vendorPatterns(ctx: RuleContext): { selectors: RegExp[]; vars: RegExp[] } | null {
  const adapter = Object.values(ctx.config.adapters).find((item) => item.facet === 'ui-kit') as
    { vendorSelectors?: string[]; vendorVars?: string[] } | undefined
  if (!adapter?.vendorSelectors?.length) return null
  return {
    selectors: adapter.vendorSelectors.map((pattern) => new RegExp(pattern)),
    vars: (adapter.vendorVars ?? []).map((pattern) => new RegExp(pattern)),
  }
}

export const vendorSelectorsConfined: Rule = {
  id: 'D10',
  domain: 'design',
  level: 'L1',
  severity: 'error',
  title: '组件库选择器只许在 vendor 目录',
  requires: ['uiKit.vendorSelectors'],
  hint: '第三方组件的选择器覆盖集中放 vendor/，别散在各处',
  run: (ctx) => {
    const params = designParams(ctx)
    const patterns = vendorPatterns(ctx)
    if (!patterns) return []
    const out: Finding[] = []
    for (const file of cssFiles(ctx)) {
      if (file.rel.startsWith(`${params.vendorDir}/`)) continue
      for (const item of file.selectors) {
        if (patterns.selectors.some((regex) => regex.test(item.selector))) {
          out.push(
            finding(
              'D10',
              file.rel,
              item.line,
              `组件库选择器出现在 vendor 之外：${item.selector.slice(0, 40)}`,
            ),
          )
        }
      }
    }
    return out
  },
}

export const vendorDirClosed: Rule = {
  id: 'D10b',
  domain: 'design',
  level: 'L1',
  severity: 'error',
  title: 'vendor 目录反向封闭',
  requires: ['uiKit.vendorSelectors'],
  hint: 'vendor/ 只放组件库覆盖；业务类名不该出现在这里',
  run: (ctx) => {
    const params = designParams(ctx)
    const patterns = vendorPatterns(ctx)
    if (!patterns) return []
    const out: Finding[] = []
    for (const file of cssFiles(ctx)) {
      if (!file.rel.startsWith(`${params.vendorDir}/`)) continue
      for (const item of file.selectors) {
        const vendorish = patterns.selectors.some((regex) => regex.test(item.selector))
        const variableish = patterns.vars.some((regex) => regex.test(item.selector))
        // 变量载体（:root / @media / 纯变量块）不是业务选择器
        const atRule = item.selector.startsWith('@') || /^(:root|html|\*)/.test(item.selector)
        const rule = file.rules.find((candidate) => candidate.line === item.line)
        const varOnly =
          (rule?.declarations.length ?? 0) === 0 ||
          (rule?.declarations ?? []).every((d) => d.prop.startsWith('--'))
        if (!vendorish && !variableish && !atRule && !varOnly) {
          out.push(
            finding(
              'D10b',
              file.rel,
              item.line,
              `vendor 目录里出现业务选择器：${item.selector.slice(0, 40)}`,
            ),
          )
        }
      }
    }
    return out
  },
}

/* ---------------- D11 无框架残留 ---------------- */

export const noFrameworkLeftovers: Rule = {
  id: 'D11',
  domain: 'design',
  level: 'L2',
  severity: 'error',
  title: '无框架残留',
  hint: '命中别的组件库指纹说明换库没换干净，或误引入了第二套组件库',
  run: (ctx) => {
    const adapter = Object.values(ctx.config.adapters).find((item) => item.facet === 'ui-kit') as
      { packages?: string[] } | undefined
    const others = fingerprintsOf(adapter?.packages ?? [])
    const out: Finding[] = []

    for (const file of cssFiles(ctx)) {
      for (const item of file.selectors) {
        const hit = others.find((kit) =>
          kit.selectorPrefixes.some((pattern) => new RegExp(pattern).test(item.selector)),
        )
        if (hit) {
          out.push(
            finding(
              'D11',
              file.rel,
              item.line,
              `命中 ${hit.id} 的选择器：${item.selector.slice(0, 40)}`,
            ),
          )
        }
        if (/@apply\b/.test(item.selector) || /(^|[\s,])dark:/.test(item.selector)) {
          out.push(
            finding('D11', file.rel, item.line, `禁用语法残留：${item.selector.slice(0, 40)}`),
          )
        }
      }
      for (const variable of file.vars) {
        const hit = others.find((kit) =>
          kit.varPrefixes.some((pattern) => new RegExp(pattern).test(variable.name)),
        )
        if (hit)
          out.push(
            finding('D11', file.rel, variable.line, `命中 ${hit.id} 的变量：${variable.name}`),
          )
      }
    }
    for (const rel of ctx.files) {
      if (rel.endsWith('.vue')) out.push(finding('D11', rel, 1, '残留 .vue 文件'))
    }
    return out
  },
}

/* ---------------- 注册 ---------------- */

export const designVendorRules: Rule[] = [
  contrastBaseline,
  storageKeyTwins,
  noImportant,
  vendorSelectorsConfined,
  vendorDirClosed,
  noFrameworkLeftovers,
]
