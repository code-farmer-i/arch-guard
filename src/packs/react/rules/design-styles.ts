import { parseCss } from '../../../engine/css.js'
import type { Finding, Rule } from '../../../engine/types.js'

import { cssFiles, designParams, finding } from './design-shared.js'

/**
 * 设计系统域·样式纪律（D12–D18）：魔法数字三族、内联样式、样式落点、CSS Module 契约、语义令牌。
 */

const COLOR_PROPS = new Set([
  'color',
  'background',
  'backgroundColor',
  'borderColor',
  'borderTopColor',
  'borderBottomColor',
  'fill',
  'stroke',
  'boxShadow',
  'outlineColor',
])
const LENGTH_LITERAL = /(^|[^\w-])(\d+(?:\.\d+)?)(px|rem|em|vh|vw|ch|pt)\b/
const DURATION_LITERAL = /(^|[^\w-])(\d+(?:\.\d+)?)(ms|s)\b/

/** D12–D14 共用的「值是否是裸数值」判断 */
const isBareValue = (value: string, allowed: string[]): boolean => {
  const trimmed = value.trim()
  if (allowed.includes(trimmed)) return false
  if (trimmed.includes('var(') || trimmed.includes('calc(') || trimmed.includes('clamp('))
    return false
  if (trimmed.includes('%') || trimmed.includes('auto') || trimmed.includes('inherit')) return false
  return true
}

/* ---------------- D12 魔法数字·长度 ---------------- */

export const magicLength: Rule = {
  id: 'D12',
  domain: 'design',
  level: 'L2',
  severity: 'error',
  title: '间距/尺寸必须走刻度令牌',
  hint: '写 var(--spacing-*) 之类的刻度令牌：裸数值是「每处自己发明一套间距」的起点',
  run: (ctx) => {
    const params = designParams(ctx)
    const props = new Set(params.lengthProps)
    const out: Finding[] = []
    for (const file of cssFiles(ctx)) {
      for (const rule of file.rules) {
        for (const declaration of rule.declarations) {
          if (!props.has(declaration.prop)) continue
          if (!LENGTH_LITERAL.test(declaration.value)) continue
          if (!isBareValue(declaration.value, params.allowLengthValues)) continue
          out.push(
            finding(
              'D12',
              file.rel,
              declaration.line,
              `裸长度值：${declaration.prop}: ${declaration.value}`,
              '改用刻度令牌',
            ),
          )
        }
      }
    }
    return out
  },
}

/* ---------------- D13 魔法数字·层级 ---------------- */

export const magicZIndex: Rule = {
  id: 'D13',
  domain: 'design',
  level: 'L2',
  severity: 'error',
  title: 'z-index 必须令牌',
  hint: '层级是全局资源：写 var(--sh-z-*) 才能一眼看出谁压谁',
  run: (ctx) => {
    const out: Finding[] = []
    for (const file of cssFiles(ctx)) {
      for (const rule of file.rules) {
        for (const declaration of rule.declarations) {
          if (declaration.prop !== 'z-index') continue
          const value = declaration.value.trim()
          if (value.includes('var(') || value === 'auto' || value === 'inherit') continue
          if (!/^\d+$/.test(value)) continue
          out.push(
            finding('D13', file.rel, declaration.line, `裸 z-index：${value}`, '改用层级令牌'),
          )
        }
      }
    }
    return out
  },
}

/* ---------------- D14 魔法数字·时长 ---------------- */

export const magicDuration: Rule = {
  id: 'D14',
  domain: 'design',
  level: 'L2',
  severity: 'error',
  title: '动效时长必须令牌或常量',
  hint: '时长散落各处会让整套动效节奏不一致；收进令牌或常量表',
  run: (ctx) => {
    const out: Finding[] = []
    for (const file of cssFiles(ctx)) {
      for (const rule of file.rules) {
        for (const declaration of rule.declarations) {
          if (
            !/^(transition|animation|transition-duration|animation-duration)/.test(declaration.prop)
          )
            continue
          if (!DURATION_LITERAL.test(declaration.value)) continue
          if (declaration.value.includes('var(')) continue
          out.push(
            finding(
              'D14',
              file.rel,
              declaration.line,
              `裸动效时长：${declaration.prop}: ${declaration.value}`,
            ),
          )
        }
      }
    }
    return out
  },
}

/* ---------------- D15 内联样式纪律 ---------------- */

export const inlineStyleDiscipline: Rule = {
  id: 'D15',
  domain: 'design',
  level: 'L2',
  severity: 'error',
  title: '内联样式纪律',
  hint: '颜色与尺寸别写在 JSX 里：主题切换与刻度都会绕不过去',
  run: (ctx) => {
    const out: Finding[] = []
    for (const record of ctx.records) {
      if (record.kind !== 'ts') continue
      const facts = ctx.facts.get(record.rel)
      if (!facts) continue
      for (const style of facts.inlineStyles) {
        if (COLOR_PROPS.has(style.prop)) {
          out.push(
            finding(
              'D15',
              record.rel,
              style.line,
              `内联样式写了颜色：${style.prop}: ${style.value.slice(0, 24)}`,
            ),
          )
          continue
        }
        // 裸数字（React 里数字即 px）与带单位的字符串都算
        if (
          /^-?\d+(\.\d+)?$/.test(style.value.trim()) ||
          /^-?\d+(\.\d+)?(px|rem|em)$/.test(style.value.trim())
        ) {
          out.push(
            finding(
              'D15',
              record.rel,
              style.line,
              `内联样式写了裸尺寸：${style.prop}: ${style.value}`,
            ),
          )
        }
      }
    }
    return out
  },
}

/* ---------------- D16 自研样式只在 *.module.css ---------------- */

export const stylesInModules: Rule = {
  id: 'D16',
  domain: 'design',
  level: 'L1',
  severity: 'error',
  title: '自研样式只在 *.module.css',
  hint: '全局 CSS 只放令牌与第三方覆盖；组件样式一律 CSS Module，避免类名互相污染',
  run: (ctx) => {
    const params = designParams(ctx)
    const styleDir = params.styleDir
    return ctx.records
      .filter((record) => record.kind === 'css')
      .filter((record) => !record.rel.endsWith('.module.css'))
      .filter((record) => !record.rel.startsWith(`${styleDir}/`))
      .map((record) => finding('D16', record.rel, 1, '非 CSS Module 的样式文件出现在组件目录'))
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
    const records = ctx.records.filter((record) => record.kind === 'ts' || record.kind === 'css')
    const byRel = new Map(records.map((record) => [record.rel, record]))

    for (const record of records) {
      if (!record.rel.endsWith('.module.css')) continue
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

export const semanticTokensOnly: Rule = {
  id: 'D18',
  domain: 'design',
  level: 'L2',
  severity: 'error',
  title: '组件样式只消费语义令牌',
  hint: '组件里引色板令牌（--sh-static-*）会绕过明暗两套语义层；要用语义令牌（--sh-alias-*）',
  run: (ctx) => {
    const params = designParams(ctx)
    const staticPrefix = `${params.tokenPrefix}-static-`
    const out: Finding[] = []
    for (const file of cssFiles(ctx)) {
      if (!file.rel.endsWith('.module.css')) continue
      for (const ref of file.varRefs) {
        if (!ref.name.startsWith(staticPrefix)) continue
        out.push(finding('D18', file.rel, ref.line, `组件样式直接引色板令牌：${ref.name}`))
      }
    }
    return out
  },
}

export const designStyleRules: Rule[] = [
  magicLength,
  magicZIndex,
  magicDuration,
  inlineStyleDiscipline,
  stylesInModules,
  cssModuleContract,
  semanticTokensOnly,
]
