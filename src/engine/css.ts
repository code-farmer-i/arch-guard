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
import {
  converter,
  interpolateWithPremultipliedAlpha,
  parse as parseColorValue,
  wcagContrast,
} from 'culori'
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

/**
 * 颜色值的**规范化键**（D03 用）：解析成 sRGB 之后的 `rrggbb`（不透明）/ `rrggbbaa`（带 alpha）。
 *
 * 交给 culori 解析（R-153）而不是正则抠 `#hex`，是为了让**同一个颜色的两种拼写**算同一个色值 ——
 * `--a: rgb(255, 90, 31)` 与 `--b: #ff5a1f` 在色板里就是"跨族重复"，旧实现只认 hex 字面量：
 * 前者根本取不到键，于是重复色值静默漏报。
 *
 * 解析不了的（`var(--x)` / `color-mix()` / 渐变 —— D03 只认**直接写下的**色值，`var()` 别名是
 * 官方推荐的共用方式）返回 `null`，调用方跳过。
 */
export function colorKey(value: string): string | null {
  const color = parseColor(value)
  if (!color) return null
  const hex = color.rgb.map((channel) => channel.toString(16).padStart(2, '0')).join('')
  if (color.alpha >= 1) return hex
  return `${hex}${Math.round(color.alpha * 255)
    .toString(16)
    .padStart(2, '0')}`
}

/* ---------------- 颜色求值与对比度（D07 用） ---------------- */

/**
 * sRGB 转换器与通道归一化（culori 的颜色都是 0..1 浮点，本模块内部一律用 0..255 整数）。
 *
 * **超色域的值按渲染器那样裁剪**（`color(display-p3 1 0 0)` → 转 sRGB 会得到 279 / -58 / -38）：
 * 返回 null 会让声明过的这一对**彻底不判**，而"声明过的对比度对都要算一遍"正是 D07 的立意；
 * 裁剪也是浏览器把 p3 色投到 sRGB 时的实际行为。
 */
const toSrgb = converter('rgb')

const channel255 = (value: number | undefined): number | null =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(255, Math.max(0, Math.round(value * 255)))
    : null

/**
 * CSS 颜色值 → sRGB 颜色（**词法交给 culori**，R-153）。
 *
 * 认这些写法：hex（`#rgb` / `#rgba` / `#rrggbb` / `#rrggbbaa`，alpha 真的参与求值 —— R-148）、
 * `rgb()` / `rgba()`、`hsl()` / `hsla()`、`hwb()`、`lab()` / `lch()` / `oklab()` / `oklch()`、
 * `color(display-p3 …)`、**具名色**（`white` / `rebeccapurple`）、`transparent`。
 * 旧实现只认 hex：色板里写 `rgb(255, 90, 31)` 的令牌在 D07 / D03 里**直接消失**（静默少判）。
 *
 * 解析不了（`currentColor`、`var(--x)`、垃圾值）一律返回 `null` —— 调用方跳过，**绝不产出 NaN**。
 */
const BARE_HEX = /^[0-9a-fA-F]{3,8}$/

function parseColor(value: string): ResolvedColor | null {
  const text = value.trim()
  /**
   * 裸 hex 词（没有 `#`）不是 CSS 颜色。culori 的 `parse` 为了方便也接受 `abcdef` / `beef` / `fade`，
   * 但声明值里那种写法是**无效 CSS** —— 放进来会把"漏写 `#` 的色值"当成真颜色算下去，
   * 而正确行为是解析不了就跳过（旧实现也跳过）。纯十六进制字符的词不可能撞上具名色
   * （具名色里总有 `r` / `s` / `t` / `l` 这类非 hex 字母）。
   */
  if (BARE_HEX.test(text)) return null
  const parsed = parseColorValue(text)
  if (!parsed) return null
  const srgb = toSrgb(parsed)
  if (!srgb) return null
  const rgb = [channel255(srgb.r), channel255(srgb.g), channel255(srgb.b)]
  if (rgb.some((channel) => channel === null)) return null
  const alpha =
    typeof srgb.alpha === 'number' && Number.isFinite(srgb.alpha)
      ? Math.min(1, Math.max(0, srgb.alpha))
      : 1
  return { rgb: rgb as [number, number, number], alpha }
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
  const direct = parseColor(value)
  if (direct) return direct
  const mix = value.match(/^color-mix\(\s*in\s+srgb\s*,\s*(.+?)\s+([\d.]+)%\s*,\s*(.+?)\s*\)$/)
  if (!mix) return null
  /** 操作数既可以是令牌引用，也可以是**任意 CSS 颜色字面量**（R-153：以前只认 hex） */
  const operand = (raw: string): ResolvedColor | null => {
    const ref = raw.match(/^var\((--[a-zA-Z0-9-]+)\)$/)
    if (ref) return resolveColor(vars, ref[1] as string, depth + 1)
    return parseColor(raw)
  }
  const base = operand(mix[1] as string)
  const other = operand(mix[3] as string)
  const ratio = Number(mix[2]) / 100
  if (!base || !other || !Number.isFinite(ratio)) return null
  return mixColors(base, other, ratio)
}

/**
 * CSS `color-mix(in srgb, A p%, B)` 的语义 = **premultiplied alpha 插值**：两色先按 alpha 预乘、
 * 按 `p` / `1-p` 加权、再除以合成后的 alpha。交给 culori 的 `interpolateWithPremultipliedAlpha`
 * （与 CSS 规范**逐位吻合**：`#00000080` 与 `#ffffff40` 各半 → `rgb(85,85,85) alpha 0.37647`，手算一致）。
 *
 * 这同时补掉一处静默少判（R-153）：旧实现遇到**两个都带 alpha** 的色直接返回 `null`（"不猜"），
 * 于是这类令牌在 D07 里一对都不算。culori 的 `t=0` 指第一个色，所以权重 `p` 对应 `t = 1 - p`。
 */
function mixColors(base: ResolvedColor, other: ResolvedColor, ratio: number): ResolvedColor | null {
  const toCulori = ({ rgb, alpha }: ResolvedColor) => ({
    mode: 'rgb' as const,
    r: rgb[0] / 255,
    g: rgb[1] / 255,
    b: rgb[2] / 255,
    alpha,
  })
  const mixed = toSrgb(
    interpolateWithPremultipliedAlpha([toCulori(base), toCulori(other)], 'rgb')(1 - ratio),
  )
  if (!mixed) return null
  const rgb = [channel255(mixed.r), channel255(mixed.g), channel255(mixed.b)]
  if (rgb.some((channel) => channel === null)) return null
  const alpha =
    typeof mixed.alpha === 'number' && Number.isFinite(mixed.alpha)
      ? Math.min(1, Math.max(0, mixed.alpha))
      : 1
  return { rgb: rgb as [number, number, number], alpha }
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

/**
 * WCAG 对比度（`(L1 + 0.05) / (L2 + 0.05)`）—— **换成 culori 的 `wcagContrast`**（R-153）。
 *
 * 手搓那份（`luminance` 的 gamma 展开 + 0.03928 阈值）与 culori **逐位一致**：实测 21:1 / 6.734 /
 * 3.118 / 18.09 / 1.104 / 1.000 六组全等（0..255 的整数通道上 0.03928 与 0.04045 两个阈值不分叉）。
 * 于是这里删掉自己那份数学，只留一个"0..255 整数 → culori 颜色"的适配。
 */
export function contrastRatio(a: [number, number, number], b: [number, number, number]): number {
  const toCulori = ([r, g, b]: [number, number, number]) => ({
    mode: 'rgb' as const,
    r: r / 255,
    g: g / 255,
    b: b / 255,
  })
  return wcagContrast(toCulori(a), toCulori(b))
}
