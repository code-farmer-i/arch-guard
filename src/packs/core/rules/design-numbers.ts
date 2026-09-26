import { findColorLiterals } from '../../../engine/css.js'
import type { Finding, Rule } from '../../../engine/types.js'
import { globToRegExp } from '../../../engine/util.js'

import { cssValueFamilies } from '../../../data/css-value-families.js'
import {
  cssFiles,
  designParams,
  finding,
  isTokenFile,
  numericTokens,
  whitelistOf,
} from './design-shared.js'

/**
 * D19 / D20：**「这个数字该有家」的两条**。
 *
 * - **D19 同一 `(属性, 数值)` 跨 ≥3 个非令牌文件重复**（warn）：`padding: 12px` 在 7 个组件里各写一遍 ——
 *   这其实是"事实上已经定下来的口径"，只是没有名字。判据词汇复用数值三族（D12–D14）的属性，
 *   所以 `display: flex` 这类**枚举值重复**不会被误报成"该提取令牌"。
 * - **D20 策略 / 阈值数字必须有家**（error，声明才判）：`staleTime: 300_000` 散在三个 hooks 里，
 *   要统一改口径就得全仓搜。项目把"自己关心的名字"列出来（`numberHomes`），落到家外的就报。
 */

/** D20 的声明形状（与 `designSystem({ numberHomes })` 同形；跨 files 不引预设，避免 core 依赖 presets） */
export interface NumberHome {
  name: string
  names: string[]
  in: string[]
}

/* ---------------- D19 同一数值跨文件重复 ---------------- */

/** 重复出现时，值本身的形态先归一：大小写与空白不同不算两处 */
const normalizeValue = (value: string): string => value.trim().toLowerCase().replace(/\s+/g, ' ')

/** 动态计算值（`calc(...)` 等）不进"该提取令牌"的统计：它们本来就不是一个固定的数 */
const DYNAMIC_VALUE = /\b(?:calc|clamp|min|max|var)\(/

export const repeatedCssValues: Rule = {
  id: 'D19',
  domain: 'design',
  level: 'L3',
  severity: 'warn',
  title: '同一数值跨文件重复',
  hint: '同一个值在三处以上出现 = 事实上已经定了口径，只是没有名字：给它一个令牌或刻度常量',
  run: (ctx) => {
    const params = designParams(ctx)
    const seen = new Map<
      string,
      { files: Set<string>; rel: string; line: number; prop: string; value: string }
    >()

    for (const file of cssFiles(ctx)) {
      // 令牌 / 色板文件就是这些值该待的地方
      if (isTokenFile(file.rel, params)) continue
      for (const block of file.rules) {
        for (const declaration of block.declarations) {
          const prop = declaration.prop.replace(/^--/, '')
          // 只判数值三族的属性：`display: flex` / `font-family: …` 重复是正常写法
          const family = cssValueFamilies.find((item) =>
            item.properties.some((prefix) => prop === prefix || prop.startsWith(`${prefix}-`)),
          )
          if (!family) continue
          if (DYNAMIC_VALUE.test(declaration.value)) continue // 已经走令牌 / 变量
          if (findColorLiterals(declaration.value).length > 0) continue // 颜色唯一性归 D03
          const tokens = numericTokens(declaration.value, family.units)
          if (tokens.length === 0) continue
          if (tokens.every((token) => token === '0')) continue // `margin: 0` 到处都是，不是"口径"
          // 已经在声明刻度里的值不需要再起名字（那是项目认可的刻度）
          const allow = whitelistOf(ctx, family.rule)
          if (allow !== null && tokens.every((token) => allow.includes(token))) continue

          const value = normalizeValue(declaration.value)
          const key = `${prop}=${value}`
          const hit = seen.get(key)
          if (hit) {
            hit.files.add(file.rel)
            continue
          }
          seen.set(key, {
            files: new Set([file.rel]),
            rel: file.rel,
            line: declaration.line,
            prop: declaration.prop,
            value,
          })
        }
      }
    }

    return [...seen.values()]
      .filter((entry) => entry.files.size >= 3)
      .map((entry) =>
        finding(
          'D19',
          entry.rel,
          entry,
          `${entry.prop}: ${entry.value} 在 ${entry.files.size} 个文件里重复出现 —— 该给它一个名字（令牌 / 刻度常量）`,
          '事实上已经定下来的口径没有名字：下次谁改都不确定要动几处',
        ),
      )
  },
}

/* ---------------- D20 策略 / 阈值数字必须有家 ---------------- */

export const numbersHaveHomes: Rule = {
  id: 'D20',
  domain: 'design',
  requires: ['designSystem.numberHomes'],
  level: 'L2',
  severity: 'error',
  title: '策略 / 阈值数字必须有家',
  hint: '策略与阈值是跨模块的口径：数字散在各处，改一处漏一处 —— 把它们收进声明的那个文件',
  run: (ctx) => {
    const groups = (ctx.config.params.numberHomes as NumberHome[] | undefined) ?? []
    if (groups.length === 0) return []

    // names 缺省取**方案适配器**声明的名字（`reactQueryKit().numberNames`）—— 库的事实，不必宿主抄
    const kitNames =
      (ctx.config.adapters['data-layer'] as { numberNames?: string[] } | undefined)?.numberNames ??
      []
    const out: Finding[] = []
    for (const group of groups) {
      const names = new Set(group.names && group.names.length > 0 ? group.names : kitNames)
      if (names.size === 0) continue
      const homes = group.in.map((glob) => globToRegExp(glob))
      for (const record of ctx.records) {
        if (homes.some((pattern) => pattern.test(record.rel))) continue // 在家里的不算
        const facts = ctx.facts.get(record.rel)
        const numbers = facts?.numbers ?? []
        if (numbers.length === 0) continue
        for (const number of numbers) {
          if (number.name === null || !names.has(number.name)) continue
          out.push(
            finding(
              'D20',
              record.rel,
              number,
              `${number.name}: ${number.raw} —— ${group.name}的数字该写在 ${group.in.join(' / ')}`,
              '口径只留一处：这里引用那份常量，而不是再写一个数',
            ),
          )
        }
      }
    }
    return out
  },
}
