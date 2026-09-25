import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import type { Dirent } from 'node:fs'
import { join, relative } from 'node:path'

import type { Adapter, Preset } from './types.js'
import { mergeStructureSpec } from './structure.js'

export interface WalkOptions {
  skip?: Set<string>
  extensions?: string[] | null
}

/**
 * 目录项是目录、文件，还是**应当跳过**（悬空/无权限的链接）。
 *
 * 为什么要这个分类而不是直接 `statSync` 每个条目：
 * `readdirSync(..., { withFileTypes: true })` 本来就把类型随目录项一起返回，而旧实现每个条目都补一次
 * `statSync` —— 纯 syscall 浪费，目录树一大就线性放大（实测 1131 个文件的仓库：2.1s → 0.47s）。
 *
 * 为什么还要单独处理链接：**`Dirent.isDirectory()` 描述的是链接本身**，对指向目录的符号链接返回 `false`；
 * 而 `statSync` 是**跟随**链接的。直接信 `Dirent` 就会不再跟随链接目录 —— 那是**语义变化**，不是优化
 * （`tests/cli-extra.test.mjs` 里就有一个链接目录的宿主）。所以只有链接才付一次 syscall：
 *   - 链接 + `stat` 成功 → 按目标类型判；
 *   - 链接 + `stat` 失败（悬空 / 权限）→ `skip`：与旧实现一致（旧实现 `statSync` 抛错就 `continue`，
 *     不会把悬空链接当文件收进来）；
 *   - 非链接 → 用 `Dirent`，**不** stat。
 *
 * 已知边界（沿用旧行为，未改）：目录链接成环时没有防环（`link -> .`）。这需要 realpath 记账，
 * 属于另一件事；要做得单独评估。
 */
function classifyEntry(entry: Dirent, full: string): 'dir' | 'file' | 'skip' {
  if (entry.isDirectory()) return 'dir'
  if (!entry.isSymbolicLink()) return 'file'
  try {
    return statSync(full).isDirectory() ? 'dir' : 'file'
  } catch {
    return 'skip'
  }
}

/** 目录遍历：跳过忽略项，按扩展名收文件 */
export function walk(
  dir: string,
  { skip = new Set<string>(), extensions = null }: WalkOptions = {},
): string[] {
  const out: string[] = []
  const visit = (current: string): void => {
    let entries: Dirent[]
    try {
      // 类型随目录项一起返回：省掉旧实现里"每个条目一次 statSync"
      entries = readdirSync(current, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const { name } = entry
      if (skip.has(name)) continue
      const full = join(current, name)
      const kind = classifyEntry(entry, full)
      if (kind === 'skip') continue
      if (kind === 'dir') visit(full)
      else if (!extensions || extensions.some((ext) => name.endsWith(ext))) out.push(full)
    }
  }
  visit(dir)
  return out.sort()
}

/**
 * glob → RegExp：支持 `**` / `*` / `?` / 花括号枚举，仅用于项目内相对路径匹配（L1 判定）。
 *
 * 花括号里是**字面量枚举**（`{index.ts,cli.ts}`），所以每个分支都要转义正则元字符 ——
 * 早先直接 `join('|')`，`{index.ts}` 里的 `.` 会变成"任意字符"（能匹配 `indexXts`）。
 * 花括号内不支持嵌套通配符（`{*.ts}` 会被当成字面量 `*`）：那是"没匹配上"，
 * 而不是"匹配错了" —— 门禁宁可少匹配也不要错匹配。
 */
export function globToRegExp(glob: string): RegExp {
  let out = '^'
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i] as string
    if (ch === '*') {
      if (glob[i + 1] === '*') {
        if (glob[i + 2] === '/') {
          out += '(?:.*/)?'
          i += 2
        } else {
          out += '.*'
          i += 1
        }
      } else {
        out += '[^/]*'
      }
    } else if (ch === '?') {
      out += '[^/]'
    } else if (ch === '{') {
      // 花括号枚举：{ts,tsx} → (?:ts|tsx)
      const close = glob.indexOf('}', i)
      if (close === -1) {
        out += '\\{'
      } else {
        const alternatives = glob
          .slice(i + 1, close)
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
          .map((item) => item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        out += `(?:${alternatives.join('|')})`
        i = close
      }
    } else if ('\\^$.|+()[]}'.includes(ch)) {
      out += `\\${ch}`
    } else {
      out += ch
    }
  }
  return new RegExp(`${out}$`)
}

export function sha1(text: string): string {
  return createHash('sha1').update(text).digest('hex').slice(0, 12)
}

/** 棘轮锚点：对格式化不敏感（去首尾空白、压缩内部空白） */
export function anchorOf(lineText: string | undefined): string {
  return sha1(
    String(lineText ?? '')
      .trim()
      .replace(/\s+/g, ' '),
  )
}

export function readText(file: string): string {
  return readFileSync(file, 'utf8')
}

export function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(file, 'utf8')) as T
}

export function exists(file: string): boolean {
  try {
    statSync(file)
    return true
  } catch {
    return false
  }
}

export function relOf(root: string, file: string): string {
  return relative(root, file).split('\\').join('/')
}

/**
 * 稳定序列化：只用来判"两份适配器声明是不是同一份数据"（键序不该影响结论）。
 * 不引第三方库：适配器是纯数据（`defineAdapter` 保证过），这个递归够用。
 */
const stableKey = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableKey).join(',')}]`
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b),
    )
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableKey(item)}`).join(',')}}`
  }
  return JSON.stringify(value) ?? 'undefined'
}

/** 预设合并：数组拼接，对象浅合并 */
export function mergePresets(presets: Preset[]): Preset {
  const out: Preset = { adapters: {}, params: {} }
  /** 适配器按面收敛（局部变量：`Preset.adapters` 是可选的，逐个读要处理 undefined） */
  const adapters: Record<string, Adapter> = {}
  for (const preset of presets) {
    if (preset.roles) out.roles = preset.roles
    if (preset.addRoles) out.addRoles = [...(out.addRoles ?? []), ...preset.addRoles]
    if (preset.layout) out.layout = { ...out.layout, ...preset.layout }
    if (preset.srcRoot) out.srcRoot = preset.srcRoot
    if (preset.naming) out.naming = { ...out.naming, ...preset.naming }
    if (preset.thresholds) out.thresholds = { ...out.thresholds, ...preset.thresholds }
    if (preset.adapters) {
      /**
       * 一个面**只能有一个方案**：两份 kit 声明同一个面时，浅合并会静默取后者 ——
       * 「换库换错了」/「组合 `stack()` 时手滑又写了一遍 `router(...)`」都会变成无声的结果，
       * 而适配器又不出现在报告里，现场无迹可查。这里 fail-closed：
       *
       * - 内容**完全相同**的两份声明是幂等的（`defineFacet` 对同一个面也是这个态度）；
       * - 内容不同 → 报错，并指向 `overrides.adapters`（那是显式覆盖，不是"两份并存"）。
       */
      for (const [facet, adapter] of Object.entries(preset.adapters)) {
        const existing = adapters[facet]
        if (existing && stableKey(existing) !== stableKey(adapter)) {
          throw new Error(
            `适配器面 ${facet} 被声明了两次且内容不同（${existing.id} / ${adapter.id}）：一个面只能有一个方案\n` +
              '（两份 kit 放一起会静默取后者；要覆盖预设里的那份，用 arch.config.mjs 的 `overrides.adapters`）',
          )
        }
        adapters[facet] = adapter
      }
    }
    if (preset.params) out.params = { ...out.params, ...preset.params }
    // enable 是**并集**：预设各自声明"我贡献哪几条"。任一预设说 'all' → 结果就是 'all'。
    // （旧实现是后者覆盖前者，于是 `library() + designSystem()` 会把 D 域整块静默关掉。）
    if (preset.enable === 'all' || out.enable === 'all') out.enable = 'all'
    else if (preset.enable) out.enable = [...new Set([...(out.enable ?? []), ...preset.enable])]
    if (preset.disable) out.disable = [...new Set([...(out.disable ?? []), ...preset.disable])]
    // 结构声明是**加法**：布尔取或、数组取并集、带键数组拼接（见 mergeStructureSpec）
    if (preset.structure) out.structure = mergeStructureSpec(out.structure, preset.structure)
    if (preset.entries) out.entries = [...(out.entries ?? []), ...preset.entries]
    if (preset.ignore) out.ignore = [...(out.ignore ?? []), ...preset.ignore]
    if (preset.include) out.include = [...(out.include ?? []), ...preset.include]
    if (preset.metaFramework) out.metaFramework = preset.metaFramework
    if (preset.exceptions) out.exceptions = [...(out.exceptions ?? []), ...preset.exceptions]
  }
  out.adapters = adapters
  return out
}

export const color = {
  dim: (s: string): string => `\u001b[2m${s}\u001b[0m`,
  red: (s: string): string => `\u001b[31m${s}\u001b[0m`,
  yellow: (s: string): string => `\u001b[33m${s}\u001b[0m`,
  green: (s: string): string => `\u001b[32m${s}\u001b[0m`,
  cyan: (s: string): string => `\u001b[36m${s}\u001b[0m`,
  bold: (s: string): string => `\u001b[1m${s}\u001b[0m`,
}
