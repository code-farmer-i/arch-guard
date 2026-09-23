import { normalizeHex } from '../../../engine/css.js'
import type { Finding, Rule } from '../../../engine/types.js'

import { cssFiles, designParams, finding, isTokenFile, tryRead } from './design-shared.js'

/* ---------------- D03 色值唯一 ---------------- */

export const paletteColorUnique: Rule = {
  id: 'D03',
  domain: 'design',
  level: 'L2',
  severity: 'error',
  title: '色板色值唯一',
  hint: '同一色值只写一次；跨族共用请写成 var() 别名',
  run: (ctx) => {
    const params = designParams(ctx)
    const file = cssFiles(ctx).find((item) => item.rel === params.paletteFile)
    if (!file) return []
    const seen = new Map<string, { line: number; name: string }>()
    const out: Finding[] = []
    for (const item of file.vars) {
      const hex = item.value.match(/#([0-9a-fA-F]{3,8})\b/)
      if (!hex) continue
      const key = normalizeHex(hex[1] as string)
      const prev = seen.get(key)
      if (prev) {
        out.push(
          finding(
            'D03',
            file.rel,
            item.line,
            `色值 #${key} 与 ${prev.name}（第 ${prev.line} 行）重复`,
          ),
        )
        continue
      }
      seen.set(key, { line: item.line, name: item.name })
    }
    return out
  },
}

/* ---------------- D04 引用闭合（无悬空 var） ---------------- */

export const tokenRefsClosed: Rule = {
  id: 'D04',
  domain: 'design',
  level: 'L3',
  severity: 'error',
  title: '令牌引用闭合',
  hint: '悬空引用说明令牌被改名或删了；改名要一次改完消费方',
  run: (ctx) => {
    const files = cssFiles(ctx)
    const defined = new Set<string>()
    for (const file of files) for (const item of file.vars) defined.add(item.name)
    const out: Finding[] = []
    for (const file of files) {
      for (const ref of file.varRefs) {
        if (defined.has(ref.name) || ref.hasFallback) continue
        out.push(finding('D04', file.rel, ref.line, `未定义的令牌引用：${ref.name}`))
      }
    }
    return out
  },
}

/* ---------------- D05 无死令牌 ---------------- */

export const noDeadTokens: Rule = {
  id: 'D05',
  domain: 'design',
  level: 'L3',
  severity: 'error',
  title: '无死令牌',
  hint: '没被任何地方引用的令牌就是死代码，删掉或接上消费方',
  run: (ctx) => {
    const params = designParams(ctx)
    const files = cssFiles(ctx)
    const mention = /--[a-zA-Z0-9-]+(?![a-zA-Z0-9-])/g
    const defLine = /^\s*(--[a-zA-Z0-9-]+)\s*:/

    // 只在令牌目录里统计定义（vendor 的组件库令牌由组件库运行时消费，判死会误伤）
    const defined = new Map<string, { line: number; file: string }>()
    const edges = new Map<string, Set<string>>()

    /** 令牌定义行 → 该行提到的其他令牌；其他行 → 根 */
    const scan = (file: string, text: string, isDefFile: boolean, roots: Set<string>): void => {
      for (const [index, raw] of text.split('\n').entries()) {
        const line = raw.replace(/\/\*[\s\S]*?\*\//g, ' ')
        const names = line.match(mention) ?? []
        const def = isDefFile ? line.match(defLine) : null
        if (def?.[1]) {
          const refs = edges.get(def[1]) ?? new Set<string>()
          for (const name of names) if (name !== def[1]) refs.add(name)
          edges.set(def[1], refs)
          if (!defined.has(def[1])) defined.set(def[1], { line: index + 1, file })
          continue
        }
        // 非定义行：这里出现的令牌都算「被引用」——含 TS 里的令牌清单字符串
        for (const name of names) roots.add(name)
      }
    }

    const roots = new Set<string>()
    for (const file of files) scan(file.rel, file.text, isTokenFile(file.rel, params), roots)
    for (const record of ctx.records) {
      if (record.kind !== 'ts') continue
      scan(record.rel, ctx.sourceOf(record.rel) ?? '', false, roots)
    }
    const html = tryRead(ctx, 'index.html')
    if (html) scan('index.html', html, false, roots)
    // 对比度基线引用的令牌也算活着（项目专有数据，宿主声明）
    for (const pair of params.contrastPairs) {
      roots.add(pair.fg)
      roots.add(pair.bg)
      if (pair.parent) roots.add(pair.parent)
    }

    const live = new Set<string>()
    const queue = [...roots]
    while (queue.length > 0) {
      const name = queue.pop() as string
      if (live.has(name)) continue
      live.add(name)
      for (const next of edges.get(name) ?? []) if (!live.has(next)) queue.push(next)
    }

    const out: Finding[] = []
    for (const [name, info] of defined) {
      if (live.has(name)) continue
      out.push(finding('D05', info.file, info.line, `未被引用的令牌：${name}`))
      if (out.length >= 40) break
    }
    return out
  },
}

/* ---------------- D06 明暗双份 ---------------- */

export const themeTwinBlocks: Rule = {
  id: 'D06',
  domain: 'design',
  level: 'L2',
  severity: 'error',
  title: '明暗令牌双份齐全',
  hint: '两套主题的令牌名必须一致；只在一侧加的令牌会在另一侧掉色',
  run: (ctx) => {
    const params = designParams(ctx)
    const file = cssFiles(ctx).find((item) => item.rel === params.themeFile)
    if (!file) return []
    const blocks = params.themes.map((theme) => {
      const rule = file.rules.find(
        (item) =>
          item.selector.includes(`data-theme="${theme}"`) ||
          item.selector.includes(`data-theme='${theme}'`),
      )
      return {
        theme,
        line: rule?.line ?? 1,
        names: new Set((rule?.vars ?? []).map((item) => item.name)),
      }
    })
    if (blocks.some((block) => block.names.size === 0)) return []
    const reference = blocks[0] as { theme: string; line: number; names: Set<string> }
    const out: Finding[] = []
    for (const block of blocks.slice(1)) {
      for (const name of reference.names) {
        if (!block.names.has(name)) {
          out.push(
            finding(
              'D06',
              file.rel,
              block.line,
              `${block.theme} 缺少令牌：${name}（${reference.theme} 有）`,
            ),
          )
        }
      }
      for (const name of block.names) {
        if (!reference.names.has(name)) {
          out.push(
            finding(
              'D06',
              file.rel,
              reference.line,
              `${reference.theme} 缺少令牌：${name}（${block.theme} 有）`,
            ),
          )
        }
      }
    }
    return out
  },
}

/* ---------------- 注册 ---------------- */

export const designTokenRules: Rule[] = [
  // 颜色字面量委派给 stylelint（color-no-hex + overrides 给色板开口）
  paletteColorUnique,
  tokenRefsClosed,
  noDeadTokens,
  themeTwinBlocks,
]
