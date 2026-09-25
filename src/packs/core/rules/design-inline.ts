import { findColorLiterals } from '../../../engine/css.js'
import type { Finding, Rule } from '../../../engine/types.js'

import { cssValueFamilies } from '../../../data/css-value-families.js'
import { finding, numericTokens, whitelistOf } from './design-shared.js'

/**
 * D15 **内联样式纪律**：JSX `style={{ … }}` 与 CSS 走同一套刻度。
 *
 * 为什么需要（原先委派 eslint `no-restricted-syntax`）：同一条红线，写进 `.module.css` 会报
 * （D01 / D12 / D13 / D14），写进 `style={{}}` 一条都不报 —— **换个写法就绕过整套令牌**。
 * 实测（0.4.0 之前）：`<div style={{ color: '#ff5a1f', margin: 13, zIndex: 9999 }}>` D 域零命中。
 *
 * 判据只用已有事实（`facts.styleProps`：JSX `style` 里**字面量**属性），**不猜**：
 * 变量 / 模板插值（`color: token`）不是字面量，压根不进 facts —— 那正是它该有的样子。
 */

/** 颜色类属性名（camelCase 原样比；`borderWidth: 1` 因为没有颜色字面量而不会被误判） */
const COLOR_PROP = /color|background|shadow|fill|stroke|border/i

/** camelCase → kebab（`backgroundColor` → `background-color`；`zIndex` → `z-index`） */
const kebab = (prop: string): string =>
  prop
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/^--/, '')

/** 归一后按前缀归入数值三族（`margin-top` 归 D12 的长度族） */
const familyOfProp = (prop: string) => {
  const name = kebab(prop)
  return (
    cssValueFamilies.find((family) =>
      family.properties.some((prefix) => name === prefix || name.startsWith(`${prefix}-`)),
    ) ?? null
  )
}

/** `lineHeight: 1.5` 的无单位数字是 CSS 的正规写法（倍数），不是魔法数字 */
const UNITLESS_OK = new Set(['line-height'])

export const inlineStyleDiscipline: Rule = {
  id: 'D15',
  domain: 'design',
  requires: ['designSystem.styleDir'],
  level: 'L2',
  severity: 'error',
  title: '内联样式纪律',
  hint: '内联 style 绕过整条令牌链：颜色写进组件样式文件、数值走刻度令牌 —— `style={{}}` 不是后门',
  run: (ctx) => {
    const out: Finding[] = []
    for (const record of ctx.records) {
      const facts = ctx.facts.get(record.rel)
      const styleProps = facts?.styleProps ?? []
      if (styleProps.length === 0) continue

      for (const item of styleProps) {
        /* ① 颜色字面量：颜色类属性里出现 hex / rgb(a) / hsl(a) 就报 */
        if (COLOR_PROP.test(item.prop) && findColorLiterals(item.value).length > 0) {
          out.push(
            finding(
              'D15',
              record.rel,
              item.line,
              `内联样式里写死颜色：${item.prop}: ${item.value}`,
              '颜色只写进色板 / 令牌，这里用 var(--token)：内联的色值换主题时不跟着变',
            ),
          )
          continue
        }

        /* ② 数值：归入三族时按声明的刻度判（哪族声明判哪族） */
        const family = familyOfProp(item.prop)
        if (!family) continue
        const allow = whitelistOf(ctx, family.rule)
        if (allow === null) continue // 声明才判
        // 无单位数字 0 到处都在（`margin: 0`），归一成 `0px` 之前先放过
        if (item.numeric && Number(item.value) === 0) continue
        if (UNITLESS_OK.has(kebab(item.prop)) && item.numeric) continue

        // 无单位数字：React 会补该族的第一种单位（长度 → px，时长 → ms）；无单位族（z-index）原样比
        const text =
          item.numeric && family.units.length > 0 ? `${item.value}${family.units[0]}` : item.value
        const allowed = new Set(allow)
        for (const token of numericTokens(text, family.units)) {
          if (token === '0' || allowed.has(token)) continue
          out.push(
            finding(
              'D15',
              record.rel,
              item.line,
              `内联样式里的魔法数字：${kebab(item.prop)}: ${token} 不在${family.title}的刻度里（允许：${allow.join(' / ')}）`,
              family.hint,
            ),
          )
        }
      }
    }
    return out
  },
}
