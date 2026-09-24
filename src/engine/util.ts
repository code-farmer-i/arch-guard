import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

import type { Preset } from './types.js'

export interface WalkOptions {
  skip?: Set<string>
  extensions?: string[] | null
}

/** 目录遍历：跳过忽略项，按扩展名收文件 */
export function walk(
  dir: string,
  { skip = new Set<string>(), extensions = null }: WalkOptions = {},
): string[] {
  const out: string[] = []
  const visit = (current: string): void => {
    let entries: string[]
    try {
      entries = readdirSync(current)
    } catch {
      return
    }
    for (const name of entries) {
      if (skip.has(name)) continue
      const full = join(current, name)
      let stat
      try {
        stat = statSync(full)
      } catch {
        continue
      }
      if (stat.isDirectory()) visit(full)
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

/** 预设合并：数组拼接，对象浅合并 */
export function mergePresets(presets: Preset[]): Preset {
  const out: Preset = { adapters: {}, params: {} }
  for (const preset of presets) {
    if (preset.roles) out.roles = preset.roles
    if (preset.addRoles) out.addRoles = [...(out.addRoles ?? []), ...preset.addRoles]
    if (preset.layout) out.layout = { ...out.layout, ...preset.layout }
    if (preset.srcRoot) out.srcRoot = preset.srcRoot
    if (preset.naming) out.naming = { ...out.naming, ...preset.naming }
    if (preset.thresholds) out.thresholds = { ...out.thresholds, ...preset.thresholds }
    if (preset.adapters) out.adapters = { ...out.adapters, ...preset.adapters }
    if (preset.params) out.params = { ...out.params, ...preset.params }
    // enable 是**并集**：预设各自声明"我贡献哪几条"。任一预设说 'all' → 结果就是 'all'。
    // （旧实现是后者覆盖前者，于是 `library() + designSystem()` 会把 D 域整块静默关掉。）
    if (preset.enable === 'all' || out.enable === 'all') out.enable = 'all'
    else if (preset.enable) out.enable = [...new Set([...(out.enable ?? []), ...preset.enable])]
    if (preset.disable) out.disable = [...new Set([...(out.disable ?? []), ...preset.disable])]
    // 结构声明是**加法**：布尔取或、数组取并集（和 enable/disable 一个道理）
    if (preset.structure) {
      const prev = out.structure ?? {}
      out.structure = {
        ...(prev.order || preset.structure.order ? { order: true } : {}),
        isolate: [...new Set([...(prev.isolate ?? []), ...(preset.structure.isolate ?? [])])],
        publicApi: [...new Set([...(prev.publicApi ?? []), ...(preset.structure.publicApi ?? [])])],
      }
    }
    if (preset.entries) out.entries = [...(out.entries ?? []), ...preset.entries]
    if (preset.ignore) out.ignore = [...(out.ignore ?? []), ...preset.ignore]
    if (preset.include) out.include = [...(out.include ?? []), ...preset.include]
    if (preset.metaFramework) out.metaFramework = preset.metaFramework
    if (preset.exceptions) out.exceptions = [...(out.exceptions ?? []), ...preset.exceptions]
  }
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
