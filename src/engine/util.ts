import { createHash } from 'node:crypto'
import { MERGE_SPEC, mergeByKind } from './merge-spec.js'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import type { Dirent } from 'node:fs'
import { join, relative } from 'node:path'
import picomatch from 'picomatch'

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
 * glob → RegExp：项目内相对路径匹配（角色表 / `ignore` / `include` / `exceptions` / `--paths` …）。
 *
 * **实现交给 picomatch**（R-149）。手搓版只认 `**` / `*` / `?` / 花括号字面量枚举，**不支持 `[...]` 字符类** ——
 * 在 `**` 后面接 `[a-z]*.ts` 这种写法会被编译成**字面量**（方括号被转义），于是永不匹配；extglob 同样不支持。
 * 对门禁来说 **欠匹配 = 静默不判**：实测同一个宿主把 `include` 从 `src/shared/**` 换成带字符类的同义写法后，
 * `[S05]` 与 `[S08]` 两条 error 一起消失，报告只多一句"域外 2 个文件不判契约"。
 *
 * 三个口径是刻意的：
 * - **`dot: true`**：`**` 要能命中 `.agents/x.ts` 这类点文件（旧实现如此，picomatch 默认不匹配）——
 *   不传就是**行为变更**：点文件会从角色判定里静默消失。
 * - **`nonegate: true`**：**不引入** `!` 取反语法。旧实现把首字符 `!` 当字面量，凭空多出一套取反语义
 *   属于行为变更，不该夹在"补 glob 能力"里（要支持取反就另开需求 + 文档 + 夹具）。
 * - **尾随 `/**` 再补一层 `/*`**（见下）：这些 glob 是**文件**匹配器，尾随 `**` 得要求"至少还有一层"。
 */
const TRAILING_GLOBSTAR = /\/\*\*$/

/**
 * 编译缓存：**同一份 glob 只让 picomatch 编译一次**。
 *
 * 为什么要它（实测）：picomatch 的编译比旧手搓版慢约 **4×**（8 个 glob 一轮 14.8µs → 58µs），
 * 而仓里有几处是**按文件**调 `globToRegExp` 的（`structure-discipline` 的 `globs.some(glob => …)`
 * 在每条记录上跑一次）—— 大宿主上会变成 O(文件 × glob) 次编译。缓存后同一轮只要 **2.2µs**，
 * 比旧实现还快 ~7×。glob 来自配置，种类有限，这张表不会无界增长。
 *
 * 返回的是**新 RegExp 实例**（不是缓存里那个）：调用方拿到的东西与从前一样互不影响。
 */
const REGEXP_CACHE = new Map<string, RegExp>()

export function globToRegExp(glob: string): RegExp {
  /**
   * 标准 globstar 里 `a/**` **也匹配 `a` 本身**（picomatch 如此）。对这些模式却是错的：
   * `src/features/{slice}/{segment}/**` 会把 `src/features/x/index.tsx` 匹配成 `segment = index.tsx` ——
   * 与"切片入口"角色撞车 → S01 歧义（实测在 `fsd()` 的 `pages/features` 层上成立），
   * 而 `src/modules/{domain}/**` 会把 `src/modules/loose.ts` 当成 `domain = loose.ts`。
   * 补一层 `/*` 就回到"尾随 `**` 后面至少还有一层"的语义 —— 与旧实现**零行为变更**，
   * 本次真正新增的只有"字符类与 extglob 真的能用"。
   */
  const cached = REGEXP_CACHE.get(glob)
  if (cached) return new RegExp(cached.source, cached.flags)
  const pattern = TRAILING_GLOBSTAR.test(glob) ? `${glob}/*` : glob
  const compiled = picomatch.makeRe(pattern, { dot: true, nonegate: true })
  REGEXP_CACHE.set(glob, compiled)
  return new RegExp(compiled.source, compiled.flags)
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
    /**
     * **非 `special` 的键一律读表合并**（R-144）：语义声明在 `MERGE_SPEC`，这里只执行 ——
     * `single` 后者赢 / `fields` 逐键 / `union` 并集 / `concat` 拼接。
     * 新键不会顺手获得某种"碰巧"的语义（不加表就没人合它）。
     */
    for (const [key, spec] of Object.entries(MERGE_SPEC)) {
      if (spec.presets === 'n/a' || spec.presets === 'special') continue
      const next = (preset as Record<string, unknown>)[key]
      if (next === undefined) continue
      ;(out as Record<string, unknown>)[key] = mergeByKind(
        spec.presets,
        (out as Record<string, unknown>)[key],
        next,
      )
    }
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
    // enable 是**并集**：预设各自声明"我贡献哪几条"。任一预设说 'all' → 结果就是 'all'。
    // （旧实现是后者覆盖前者，于是 `library() + designSystem()` 会把 D 域整块静默关掉。）
    if (preset.enable === 'all' || out.enable === 'all') out.enable = 'all'
    else if (preset.enable) out.enable = [...new Set([...(out.enable ?? []), ...preset.enable])]
    // 结构声明是**加法**：布尔取或、数组取并集、带键数组拼接（见 mergeStructureSpec）
    if (preset.structure) out.structure = mergeStructureSpec(out.structure, preset.structure)
  }
  out.adapters = adapters
  return out
}

/**
 * **颜色开关**（UX）：以前无论哪里都硬拼 ANSI，于是管道 / CI 日志 / 读屏软件里全是转义序列。
 *
 * 按事实标准来：
 * - `NO_COLOR` 只要**非空**就无色（<https://no-color.org>，优先级最高）；
 * - `FORCE_COLOR` 只要**非空就表态** —— `0` / `false` 是**显式关闭**，其余值强制有色（R-146）；
 * - `TERM=dumb` = 终端自述不支持样式 → 无色；
 * - 都没有：**只在 stdout 是 TTY 时上色**。
 *
 * **R-146 修的坑**：原来写的是"非空且非 `'0'` 才强制开"，于是 `FORCE_COLOR=0` 会掉到最后的 TTY 判断 ——
 * 在**真终端**里反而上了色（只在管道里"看起来对"）。`TERM=dumb` 当时也不认。
 *
 * 这里**故意不缓存** env：测试要能在同一进程里改环境验证各分支，而读取本身是微秒级。
 */
export function colorsEnabled(): boolean {
  const env = process.env
  if (env.NO_COLOR !== undefined && env.NO_COLOR !== '') return false
  if (env.FORCE_COLOR !== undefined && env.FORCE_COLOR !== '') {
    const value = env.FORCE_COLOR.trim().toLowerCase()
    return value !== '0' && value !== 'false'
  }
  if (env.TERM === 'dumb') return false
  return process.stdout.isTTY === true
}

const paint = (code: string, s: string): string =>
  colorsEnabled() ? `\u001b[${code}m${s}\u001b[0m` : s

export const color = {
  dim: (s: string): string => paint('2', s),
  red: (s: string): string => paint('31', s),
  yellow: (s: string): string => paint('33', s),
  green: (s: string): string => paint('32', s),
  cyan: (s: string): string => paint('36', s),
  bold: (s: string): string => paint('1', s),
}
