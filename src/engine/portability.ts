import { join } from 'node:path'

import { extractFacts } from './facts.js'
import type { Finding } from './types.js'
import { readText, relOf, walk } from './util.js'

/**
 * 本体自包含检查（见 README.md「本体自包含」）：
 * P1 只依赖 node:* / 白名单第三方 / 本体内相对路径
 * P2 不得出现宿主项目字面量（宿主名、绝对路径）
 * P3 引擎层不得假设项目布局（engine/** 不许出现 'src/' 这类字符串字面量）
 *
 * 说明：只扫**字符串字面量**（注释里写这些词是合法的），并排除自检模块自身。
 */

/**
 * 运行时依赖白名单：除 Node 内置与自身外，本体只允许这些。
 *
 * **这是一道审查门，不是"零依赖"洁癖**：本包以 npm 包发布，"可整目录复制"早已不是发布形态，
 * 所以要看的是「门禁读你全量源码、跑在 CI —— 新依赖有没有人看过、会不会把宿主拖进版本冲突」。
 * 要加依赖：改这里 + `package.json`，并在 CHANGELOG 写明理由。
 */
const ALLOWED_BARE_IMPORTS = new Set([
  'typescript',
  'commander',
  // 词形判定（S31）：`pluralize` 有十多年迭代的词表；手写表在 315 个真实名字的语料上有 2.9% 分歧
  // （含 `alias`/`atlas` 误报、`apis` 漏报的真 bug）。库名只出现在 `src/data/plural-forms.ts`（P4 允许数据表）。
  'pluralize',
  // glob 匹配（R-149）：手搓版不支持 `[...]` 字符类 → `include` 欠匹配 = 静默不判（S05/S08 会一起消失）。
  // 只要 `src/engine/util.ts` 的 `globToRegExp`；`dot: true` / `nonegate: true` 的取舍见那里的注释。
  'picomatch',
  // CSS 解析（R-145）：postcss 是事实标准 CSS AST，线性解析 + 源位置；自研字符扫描器会**静默错解**
  // （值里一个 `;`/`}` 就丢声明）且是 O(文件长度²)。只看 `src/engine/css.ts`。
  // 后两个是 Sass / Less 专有语法的语法插件：`.scss`/`.less` 本来就在扫描范围内，
  // 不托底等于"宿主用了 Sass 就红"。见 docs/DESIGN.md §6.1.2。
  'postcss',
  'postcss-scss',
  'postcss-less',
  // CSS **值**的词法（R-150）：`calc()` / `min()` / `var()` 的回退值里也是值，
  // 正则切不出来 → D12–D14 对 `calc()` 完全失效。只用于 `packs/core/rules/design-shared.ts` 的 numericTokens。
  'postcss-value-parser',
  // 颜色词法与 WCAG 对比度（R-153）：`rgb()` / `hsl()` / 具名色 / `color-mix` 的 premultiplied
  // 插值都交给它，只用于 `engine/css.ts`。自带类型（`@types/culori` 是 devDep）。
  'culori',
])
/** 宿主项目名（换宿主时改这里；本体不该认识任何具体宿主） */
const HOST_MARKERS = ['superhive']
const SELF_FILE = 'src/engine/portability.ts'

export interface PortabilityResult {
  findings: Finding[]
  checked: number
}

/**
 * P4：**库名只许出现在适配器面（`presets/<面>/*`）与数据表（`data/*`）**。
 *
 * 名单不新增第二份：从允许位置里**自己长出来** —— 按约定登记的包名数组
 * （键名 `from` / `packages` / `preferred`，或常量名里含 `Packages` / `Kits` / `Names`）。
 * 于是 engine / packs / 通用预设里出现任何已登记库名都会报错，而且新增 kit 自动纳入扫描。
 *
 * 为什么需要它：`copy()` 曾把 i18next 适配器内联在通用预设里（`--verify-deps` 还会拿它对账
 * package.json），`engine/deps-audit.ts` 与 `packs/.../deps-adapters.ts` 各自抄过一份库名名单 ——
 * docs/DESIGN.md §7.3 早就承诺了这条自检，但一直没实现。
 */
const LIBRARY_ARRAY_PATTERNS = [
  /(?:from|packages|preferred)\s*:\s*\[([^\]]*)\]/g,
  /(?:const|let)\s+\w*(?:Packages|Kits|Names)\w*\s*(?::\s*[\w[\]]+\s*)?=\s*\[([^\]]*)\]/g,
]

/** 库名的允许位置：数据表与适配器面（`presets/<面>/…`） */
function isLibraryAllowed(rel: string): boolean {
  return rel.startsWith('src/data/') || /^src\/presets\/[^/]+\//.test(rel)
}

/** 库名的禁止位置：引擎、框架包、以及**通用预设**（`presets/*.ts` 顶层文件） */
function isLibraryForbidden(rel: string): boolean {
  return (
    rel.startsWith('src/engine/') ||
    rel.startsWith('src/packs/') ||
    /^src\/presets\/[^/]+\.ts$/.test(rel)
  )
}

/**
 * 只把**包名形状**的名字入名单：`@scope/name` 或含 `-` / `.` 的（`react-i18next`、`element-plus`）。
 * 纯单词库名（`antd`、`bootstrap`、`none`）**故意不收** —— 它们与项目里的槽位名 / 标识符
 * 无法区分（`canonical.ts` 的 `slot: 'bootstrap'` 就是例子），收了就是误报。
 * 代价：孤立的纯单词库名散落到引擎里不会被这条逮住；实际违规几乎总是成组的
 * （三处历史违规里都至少有一个带 scope / 短横线的名字）。
 */
const SIGNAL_NAME = /[/.-]/

function libraryNamesIn(files: string[]): Set<string> {
  const names = new Set<string>()
  for (const file of files) {
    const text = readText(file)
    for (const pattern of LIBRARY_ARRAY_PATTERNS) {
      for (const match of text.matchAll(pattern)) {
        for (const item of (match[1] ?? '').matchAll(/'([^']+)'/g)) {
          const name = item[1] as string
          if (!SIGNAL_NAME.test(name)) continue
          names.add(name)
        }
      }
    }
  }
  return names
}

export function checkPortability(packageRoot: string): PortabilityResult {
  const files = walk(join(packageRoot, 'src'), { extensions: ['.ts'] })
  const findings: Finding[] = []
  const libraryNames = libraryNamesIn(
    files.filter((file) => isLibraryAllowed(relOf(packageRoot, file))),
  )

  for (const file of files) {
    const rel = relOf(packageRoot, file)
    if (rel === SELF_FILE) continue
    const text = readText(file)
    const facts = extractFacts({ file, rel, role: 'tool', text })

    /* P1 依赖白名单 */
    for (const imported of facts.imports) {
      const spec = imported.spec
      if (spec.startsWith('./') || spec.startsWith('../')) continue
      if (spec.startsWith('node:') || ALLOWED_BARE_IMPORTS.has(spec)) continue
      findings.push({
        rule: 'P1',
        file: rel,
        line: imported.line,
        text: `依赖没登记：${spec}`,
        hint: '新增运行时依赖要在 package.json 与本文件的 ALLOWED_BARE_IMPORTS 里显式登记（并写清理由），不许顺手引进来',
        global: true,
      })
    }

    /* P4 库名只许出现在适配器面与数据表 */
    if (libraryNames.size > 0 && isLibraryForbidden(rel)) {
      for (const literal of facts.strings) {
        const hit = [...libraryNames].find(
          (name) => literal.value === name || literal.value.startsWith(`${name}/`),
        )
        if (!hit) continue
        findings.push({
          rule: 'P4',
          file: rel,
          line: literal.line,
          text: `库名只许出现在 presets/<面>/* 与 data/*：${hit}`,
          hint: '把库放到数据表（src/data）或适配器面（presets/ui-kits、presets/i18n-kits…）；引擎与通用预设里只留路径与字段（纯单词库名与槽位名无法区分，不入名单）',
          global: true,
        })
      }
    }

    /* P2 / P3 只看字符串字面量 */
    for (const literal of facts.strings) {
      for (const marker of HOST_MARKERS) {
        if (!literal.value.includes(marker)) continue
        findings.push({
          rule: 'P2',
          file: rel,
          line: literal.line,
          text: `本体里出现宿主项目字面量：${marker}`,
          hint: '宿主相关的东西只能出现在宿主的 arch.config.mjs',
          global: true,
        })
      }
      if (literal.value.includes('/Users/')) {
        findings.push({
          rule: 'P2',
          file: rel,
          line: literal.line,
          text: '本体里出现绝对路径',
          global: true,
        })
      }
      if (rel.startsWith('src/engine/') && literal.value.startsWith('src/')) {
        findings.push({
          rule: 'P3',
          file: rel,
          line: literal.line,
          text: "引擎层不得硬编码 'src/' 布局（布局由预设/配置给出）",
          global: true,
        })
      }
    }
  }

  return { findings, checked: files.length }
}
