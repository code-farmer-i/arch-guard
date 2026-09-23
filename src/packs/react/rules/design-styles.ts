import { parseCss } from '../../../engine/css.js'
import type { Finding, Rule } from '../../../engine/types.js'

import { designParams, finding } from './design-shared.js'

/**
 * 设计系统域·样式纪律（D12–D18）：魔法数字三族、内联样式、样式落点、CSS Module 契约、语义令牌。
 */

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

export const designStyleRules: Rule[] = [
  // 魔法数字三族委派给 stylelint declaration-property-value-allowed-list
  stylesInModules,
  cssModuleContract,
]
