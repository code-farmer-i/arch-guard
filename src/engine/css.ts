/**
 * CSS 结构化模型（框架无关）—— 解析交给 **postcss**（选型与边界见 docs/DESIGN.md §6.1.2）。
 *
 * 为什么不再自研：那份约 60 行的字符扫描器**不是"保守跳过"而是静默错解** ——
 *   ① 值里出现 `;` / `}` 就错位：`.b{content:";}";background:url(data:…;base64,AAA=)}` 会丢掉整条 `background`；
 *   ② at-rule 前奏（`@media (…)` / `@layer base`）被当成选择器收进 `selectors`，污染 D10 / D10b / P11；
 *   ③ 每条声明的行号都从头 `slice().split('\n')` 算一次 → **O(文件长度²)**（实测 279KB 要 2.2 秒）。
 * 证据与验收见 REQUIREMENTS.md 的 R-145 与 `.scratch/css-parser/spec.md`。
 *
 * 本模块是**唯一的 CSS 解析入口**：只对外给归一化模型（`CssModel`），规则层不碰 postcss AST ——
 * 与 §6.1.1「规则不消费 TS AST」同一口径，换解析器只改这里。
 */
import { cssSyntaxes, type CssSyntaxId } from '../data/css-syntaxes.js'
import postcss, { type ChildNode, type Declaration, type Root } from 'postcss'
import postcssLess from 'postcss-less'
import { parse as parseScss } from 'postcss-scss'

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
  /** 选择器里出现的 `.ant-` 这类厂商前缀（供 D10/D10b 用）—— **只收规则的选择器，不含 at-rule 前奏** */
  selectors: { selector: string; line: number }[]
}

const cssLineOf = (text: string, index: number): number => text.slice(0, index).split('\n').length

/**
 * 按扩展名选语法（数据表 `src/data/css-syntaxes.ts` 是唯一出处）。
 *
 * 为什么要区分：`.scss` / `.less` 的专有写法（`#{$x}` / `@{x}` / `//` 注释）在标准 CSS 解析器下
 * **直接抛错**（实测 `.icon-#{$name}{}` → `Unknown word $name`），而两种扩展名本来就在扫描范围内。
 * 认不出的扩展名退回标准语法（`parseCss` 只对 CSS 类文件调用）。
 */
const PARSERS: Record<CssSyntaxId, (css: string, opts: { from: string }) => Root> = {
  css: (css, opts) => postcss.parse(css, opts),
  scss: parseScss,
  less: postcssLess.parse,
}

const syntaxOf = (rel: string): CssSyntaxId =>
  cssSyntaxes.find((item) => rel.endsWith(item.extension))?.syntax ?? 'css'

const VAR_REF = /var\(\s*(--[a-zA-Z0-9-]+)\s*([,)])/g

/**
 * 声明值：**`!important` 要留在值里** —— D09 是拿 `declaration.value` 正则判的，
 * 而 postcss 把它拆到了 `decl.important` / `decl.raws.important` 上。
 * 值里的注释由 postcss 直接去掉（等价于旧实现的注释遮罩），raw 拼写只在必要时保留。
 */
const valueOf = (node: Declaration): string =>
  node.important ? `${node.value}${node.raws.important ?? ' !important'}` : node.value

/**
 * 坏语法 **fail closed**：抛错（退出码 2），而不是像旧扫描器那样静默错解。
 * TS 侧的坏语法是 S00 的 finding（facts 里有 `parseErrors`）；CSS 侧做到 finding 需要先把解析上移
 * 到 `collect`（见 `.scratch/css-parser/spec.md` 的非目标），当前至少保证"不静默"。
 */
function parseFail(rel: string, error: unknown): Error {
  if (error instanceof postcss.CssSyntaxError) {
    return new Error(
      `CSS 解析失败：${rel}:${error.line}:${error.column} ${error.reason}\n` +
        '（样式语法错误会让这份文件的样式类规则全部失去判定 —— 先修语法；本工具不静默通过）',
    )
  }
  return error instanceof Error ? error : new Error(String(error))
}

export function parseCss(rel: string, text: string): CssModel {
  let root: Root
  try {
    root = PARSERS[syntaxOf(rel)](text, { from: rel })
  } catch (error) {
    throw parseFail(rel, error)
  }

  const rules: CssRule[] = []
  const vars: CssVarDef[] = []
  const varRefs: CssVarRef[] = []
  const comments: CssComment[] = []
  const selectors: { selector: string; line: number }[] = []
  /** postcss 容器（Rule / 直接装声明的 AtRule）→ 归一化块：声明挂到自己那个块上 */
  const blockOf = new Map<unknown, CssRule>()
  const lineOf = (node: ChildNode): number => node.source?.start?.line ?? 1

  root.walk((node) => {
    if (node.type === 'comment') {
      comments.push({ text: `/*${node.text}*/`, line: lineOf(node) })
      return
    }
    if (node.type === 'rule') {
      const block: CssRule = {
        selector: node.selector,
        line: lineOf(node),
        declarations: [],
        vars: [],
      }
      blockOf.set(node, block)
      rules.push(block)
      selectors.push({ selector: block.selector, line: block.line })
      return
    }
    if (node.type === 'atrule') {
      /**
       * at-rule **不是选择器** —— 只把"直接装声明"的（`@page` / `@font-face` / `@property`）算一个块，
       * 否则 `@page { margin: 13px }` 会掉出 D12–D14 / D19 的判定面（那是少判，不是收窄）。
       * `@media` / `@layer` 这类只当容器：它们的声明在里面的规则上，前奏不进 `selectors`。
       */
      if (node.nodes?.some((child) => child.type === 'decl')) {
        const block: CssRule = {
          selector: node.params ? `@${node.name} ${node.params}` : `@${node.name}`,
          line: lineOf(node),
          declarations: [],
          vars: [],
        }
        blockOf.set(node, block)
        rules.push(block)
      }
      return
    }
    if (node.type !== 'decl') return
    const line = lineOf(node)
    const value = valueOf(node)
    for (const match of value.matchAll(VAR_REF)) {
      varRefs.push({ name: match[1] as string, line, hasFallback: match[2] === ',' })
    }
    if (node.prop.startsWith('--')) {
      const definition: CssVarDef = { name: node.prop, value, line }
      vars.push(definition)
      blockOf.get(node.parent)?.vars.push(definition)
      return
    }
    blockOf.get(node.parent)?.declarations.push({ prop: node.prop, value, line })
  })

  return { rel, rules, vars, varRefs, comments, selectors }
}

/** 把注释替换成等长空格（保留行号），返回遮罩后的文本与注释清单 */
export function maskCssComments(text: string): { masked: string; comments: CssComment[] } {
  const comments: CssComment[] = []
  const masked = text.replace(/\/\*[\s\S]*?\*\//g, (block, offset: number) => {
    comments.push({ text: block, line: cssLineOf(text, offset) })
    return block.replace(/[^\n]/g, ' ')
  })
  return { masked, comments }
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

/**
 * hex → 颜色：`#rgb` / `#rgba` / `#rrggbb` / `#rrggbbaa`（CSS Color 4），**alpha 真的参与求值**。
 * 解析不了（长度不合法 / 通道或 alpha 非有限）一律返回 `null` —— **绝不产出 NaN**（R-148）：
 * 旧实现把 `#0008` 切成 `[0, 8, NaN]`，一路传成 `contrastRatio = NaN`，而 D07 的判据
 * `ratio + 1e-9 < pair.min` 对 NaN **恒为 false** → 无障碍规则静默放过；
 * 8 位 hex（`#00000080`）更隐蔽：alpha 被当成 rgb 的一部分（不透明黑），比值算错也不报。
 */
function parseHex(hex: string): ResolvedColor | null {
  if (!hex.startsWith('#')) return null
  const body = hex.slice(1).toLowerCase()
  if (!/^[0-9a-f]+$/.test(body)) return null
  const short = body.length === 3 || body.length === 4
  if (!short && body.length !== 6 && body.length !== 8) return null
  const pairs = short
    ? [...body.slice(0, 3)].map((char) => char + char)
    : (body.slice(0, 6).match(/../g) ?? [])
  const channels = pairs.map((pair) => Number.parseInt(pair, 16))
  if (channels.length !== 3 || channels.some((value) => !Number.isFinite(value))) return null
  /** 短写法 `#RGBA` 的 alpha 也要展开（`8` → `88`） */
  const rawAlpha = short ? body[3]?.repeat(2) : body.slice(6, 8)
  const alpha = rawAlpha === undefined || rawAlpha === '' ? 1 : Number.parseInt(rawAlpha, 16) / 255
  if (!Number.isFinite(alpha)) return null
  return { rgb: channels as [number, number, number], alpha }
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
  const direct = parseHex(value)
  if (direct) return direct
  const mix = value.match(
    /^color-mix\(in srgb,\s*(var\(--[a-zA-Z0-9-]+\)|#[0-9a-fA-F]{3,8})\s*([\d.]+)%,\s*(transparent|var\(--[a-zA-Z0-9-]+\)|#[0-9a-fA-F]{3,8})\)$/,
  )
  if (!mix) return null
  /** 操作数既可以是令牌引用，也可以是十六进制字面量 */
  const operand = (raw: string): ResolvedColor | null => {
    const ref = raw.match(/^var\((--[a-zA-Z0-9-]+)\)$/)
    if (ref) return resolveColor(vars, ref[1] as string, depth + 1)
    return parseHex(raw)
  }
  const base = operand(mix[1] as string)
  if (!base) return null
  const ratio = Number(mix[2]) / 100
  /** 与 `transparent` 混：等价于把 base 的 alpha 乘上权重（premultiplied 插值），色相不变 */
  if (mix[3] === 'transparent') return { rgb: base.rgb, alpha: base.alpha * ratio }
  /**
   * 两色混合：任一操作数带 alpha 就要做 premultiplied alpha，超出本函数的表达力 ——
   * **不猜**（返回 null 让规则跳过），而不是给一个错的比值。
   */
  const other = operand(mix[3] as string)
  if (base.alpha !== 1 || !other || other.alpha !== 1) return null
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
