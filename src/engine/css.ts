/**
 * 极简 CSS 结构化扫描器（框架无关，约 200 行）。
 *
 * 只解决设计系统规则要用的几件事：注释、块与选择器、声明、自定义属性定义与引用。
 * 不做嵌套/@layer/CSS-in-JS —— 遇到超范围语法时**保守跳过**，由配置文件声明支持范围。
 */
export interface CssDeclaration {
  prop: string
  value: string
  line: number
}

export interface CssRule {
  selector: string
  line: number
  declarations: CssDeclaration[]
  /** 这个块里定义的自定义属性（明暗两份的比对靠它） */
  vars: CssVarDef[]
}

export interface CssVarDef {
  name: string
  value: string
  line: number
}

export interface CssVarRef {
  name: string
  line: number
  hasFallback: boolean
}

export interface CssComment {
  text: string
  line: number
}

export interface CssModel {
  rel: string
  rules: CssRule[]
  vars: CssVarDef[]
  varRefs: CssVarRef[]
  comments: CssComment[]
  /** 选择器里出现的 `.ant-` 这类厂商前缀（供 D10/D10b 用） */
  selectors: { selector: string; line: number }[]
}

const lineOf = (text: string, index: number): number => text.slice(0, index).split('\n').length

/** 把注释替换成等长空格（保留行号），返回遮罩后的文本与注释清单 */
export function maskCssComments(text: string): { masked: string; comments: CssComment[] } {
  const comments: CssComment[] = []
  const masked = text.replace(/\/\*[\s\S]*?\*\//g, (block, offset: number) => {
    comments.push({ text: block, line: lineOf(text, offset) })
    return block.replace(/[^\n]/g, ' ')
  })
  return { masked, comments }
}

export function parseCss(rel: string, text: string): CssModel {
  const { masked, comments } = maskCssComments(text)
  const rules: CssRule[] = []
  const vars: CssVarDef[] = []
  const varRefs: CssVarRef[] = []
  const selectors: { selector: string; line: number }[] = []

  let buffer = ''
  let bufferStart = 0
  let current: CssRule | null = null

  /** startIndex 是声明缓冲的首字符位置；真正的行号要加上前导空白 */
  const flushDeclaration = (raw: string, startIndex: number): void => {
    const leading = raw.length - raw.trimStart().length
    const line = lineOf(text, startIndex + leading)
    const trimmed = raw.trim()
    if (!trimmed) return
    const colon = trimmed.indexOf(':')
    if (colon === -1) return
    const prop = trimmed.slice(0, colon).trim()
    const value = trimmed.slice(colon + 1).trim()
    if (!prop) return
    for (const match of value.matchAll(/var\(\s*(--[a-zA-Z0-9-]+)\s*([,)])/g)) {
      varRefs.push({ name: match[1] as string, line, hasFallback: match[2] === ',' })
    }
    if (prop.startsWith('--')) {
      vars.push({ name: prop, value, line })
      if (current) current.vars.push({ name: prop, value, line })
      return
    }
    if (current) current.declarations.push({ prop, value, line })
  }

  for (let i = 0; i < masked.length; i += 1) {
    const ch = masked[i] as string
    if (ch === '{') {
      const selector = buffer.trim()
      // 行号按**首个非空白字符**算：bufferStart 落在上一行结尾时，直接算会少一行
      const line = lineOf(text, bufferStart + (buffer.length - buffer.trimStart().length))
      buffer = ''
      current = { selector, line, declarations: [], vars: [] }
      if (selector) selectors.push({ selector, line })
      rules.push(current)
      continue
    }
    if (ch === '}') {
      flushDeclaration(buffer, bufferStart)
      buffer = ''
      current = null
      continue
    }
    if (ch === ';') {
      // 用声明自己的起始行：块起始行对定位毫无用处
      flushDeclaration(buffer, bufferStart)
      buffer = ''
      bufferStart = i + 1
      continue
    }
    if (buffer === '') bufferStart = i
    buffer += ch
  }
  flushDeclaration(buffer, bufferStart)

  return { rel, rules, vars, varRefs, comments, selectors }
}

/* ---------------- 颜色与数值 ---------------- */

const HEX = /#([0-9a-fA-F]{3,8})\b/g
const RGB_HSL = /\b(rgba?|hsla?|oklch|lab|lch)\(/g

export function findColorLiterals(text: string): { line: number; text: string }[] {
  const { masked } = maskCssComments(text)
  const out: { line: number; text: string }[] = []
  masked.split('\n').forEach((raw, index) => {
    if (HEX.test(raw) || RGB_HSL.test(raw)) {
      out.push({ line: index + 1, text: raw.trim() })
    }
    HEX.lastIndex = 0
    RGB_HSL.lastIndex = 0
  })
  return out
}

/** 归一化为 6 位小写（带不带 `#` 都接受；3 位缩写展开） */
export function normalizeHex(hex: string): string {
  const body = hex.trim().toLowerCase().replace(/^#/, '')
  return body.length === 3
    ? body
        .split('')
        .map((c) => c + c)
        .join('')
    : body
}

/* ---------------- 颜色求值与对比度（D07 用） ---------------- */

const toRgb = (hex: string): [number, number, number] => {
  let h = hex.slice(1)
  if (h.length === 3)
    h = h
      .split('')
      .map((c) => c + c)
      .join('')
  return [
    Number.parseInt(h.slice(0, 2), 16),
    Number.parseInt(h.slice(2, 4), 16),
    Number.parseInt(h.slice(4, 6), 16),
  ]
}

const luminance = ([r, g, b]: [number, number, number]): number => {
  const channel = (v: number): number => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  const [lr, lg, lb] = [channel(r), channel(g), channel(b)]
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb
}

export interface ResolvedColor {
  rgb: [number, number, number]
  alpha: number
}

/**
 * 解析令牌值到颜色：支持 var 链、hex、color-mix(in srgb, A p%, transparent|B)。
 * 解析不了返回 null（规则据此跳过，不瞎判）。
 */
export function resolveColor(
  vars: Map<string, string>,
  name: string,
  depth = 0,
): ResolvedColor | null {
  if (depth > 10) return null
  const value = vars.get(name)
  if (!value) return null
  const ref = value.match(/^var\((--[a-zA-Z0-9-]+)\)$/)
  if (ref) return resolveColor(vars, ref[1] as string, depth + 1)
  if (/^#[0-9a-fA-F]{3}$/.test(value) || /^#[0-9a-fA-F]{6}$/.test(value)) {
    return { rgb: toRgb(value), alpha: 1 }
  }
  const mix = value.match(
    /^color-mix\(in srgb,\s*(var\(--[a-zA-Z0-9-]+\)|#[0-9a-fA-F]{3,8})\s*([\d.]+)%,\s*(transparent|var\(--[a-zA-Z0-9-]+\)|#[0-9a-fA-F]{3,8})\)$/,
  )
  if (!mix) return null
  /** 操作数既可以是令牌引用，也可以是十六进制字面量 */
  const operand = (raw: string): ResolvedColor | null => {
    const ref = raw.match(/^var\((--[a-zA-Z0-9-]+)\)$/)
    if (ref) return resolveColor(vars, ref[1] as string, depth + 1)
    return { rgb: toRgb(raw), alpha: 1 }
  }
  const base = operand(mix[1] as string)
  if (!base) return null
  const ratio = Number(mix[2]) / 100
  if (mix[3] === 'transparent') return { rgb: base.rgb, alpha: ratio }
  const other = operand(mix[3] as string)
  if (!other || other.alpha !== 1) return null
  return {
    rgb: base.rgb.map((c, i) => Math.round(c * ratio + (other.rgb[i] as number) * (1 - ratio))) as [
      number,
      number,
      number,
    ],
    alpha: 1,
  }
}

/** 半透明色先压到某个底色上再算对比度 */
export const flatten = (
  color: ResolvedColor,
  background: [number, number, number],
): [number, number, number] =>
  color.alpha >= 1
    ? color.rgb
    : (color.rgb.map((v, i) =>
        Math.round(v * color.alpha + (background[i] as number) * (1 - color.alpha)),
      ) as [number, number, number])

export function contrastRatio(a: [number, number, number], b: [number, number, number]): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (l1 + 0.05) / (l2 + 0.05)
}
