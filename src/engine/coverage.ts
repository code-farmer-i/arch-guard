import { readFileSync, statSync } from 'node:fs'

/**
 * 覆盖率产物读取（M 域唯一的数据来源）。
 *
 * 门禁**不跑测试**（零副作用），只读别人跑完写下的产物。支持两种格式：
 * ① istanbul / c8 / vitest 的 `coverage-summary.json`（首选：有 total + 每文件四指标）
 * ② Node 内置 `--experimental-test-coverage` 的表格文本（`coverage.txt`）：
 *    Node 只输出带缩进的树，所以要按缩进栈把目录行与文件行还原成路径。
 */
export interface CoverageEntry {
  /** 相对配置根的路径（istanbul 给绝对路径时会换算） */
  rel: string
  lines: number
  branches: number
  functions: number
  statements: number
}

export interface CoverageReport {
  /** 报告文件路径 */
  path: string
  /** 报告格式 */
  format: 'istanbul-json' | 'node-table'
  /** 报告文件修改时间（ms），用于「新鲜度」判定 */
  mtimeMs: number
  files: CoverageEntry[]
}

interface IstanbulMetric {
  pct?: number
}
interface IstanbulEntry {
  lines?: IstanbulMetric
  branches?: IstanbulMetric
  functions?: IstanbulMetric
  statements?: IstanbulMetric
}

const pct = (metric: IstanbulMetric | undefined): number => {
  const value = metric?.pct
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/** 一条 istanbul 指标：`{ pct: number }` */
const isMetric = (value: unknown): boolean =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { pct?: unknown }).pct === 'number'

/** 摘要条目：至少有一个已知指标 —— `coverage-summary.json` 的 `total` 行与每个文件行都是这个形状 */
const isSummaryEntry = (value: unknown): boolean => {
  if (typeof value !== 'object' || value === null) return false
  const entry = value as Record<string, unknown>
  return ['lines', 'branches', 'functions', 'statements'].some((key) => isMetric(entry[key]))
}

/** istanbul 的**原始**格式（`coverage-final.json`）：值里是这些映射，而不是 `pct` */
const RAW_COVERAGE_KEYS = ['statementMap', 'fnMap', 'branchMap', 's', 'f', 'b'] as const

/** 把 istanbul 的绝对路径换算成配置根相对路径；换不了就原样保留 */
function relativize(rawPath: string, root: string): string {
  if (!rawPath.startsWith('/')) return rawPath
  const prefix = root.endsWith('/') ? root : `${root}/`
  return rawPath.startsWith(prefix) ? rawPath.slice(prefix.length) : rawPath
}

/**
 * istanbul / c8 / vitest 的 `coverage-summary.json`：顶层 `total` + 每个文件四指标 `pct`。
 *
 * **认不出来就抛错**（R-152）：以前"是 JSON 就当摘要"，于是
 * ① `coverage-final.json`（istanbul 的**原始**格式）被静默算成**四个 0**；
 * ② 指到 `package.json` 更离谱 —— 它把 `name` / `version` / `private` 当成**三个文件**算 0%。
 * M 域（M02 目录下限 / M04 棘轮 / M05 变更覆盖率）于是按一份假数据下结论，而报告一个字不说。
 * 与 M06 的「产物读不到就 fail-closed」同一口径：**读到了但读不懂，也要报**（错误由 M06 呈现，带修法）。
 */
function parseIstanbul(text: string, path: string, root: string, mtimeMs: number): CoverageReport {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch (error) {
    // 转抛也要留住根因（eslint `preserve-caught-error`）：JSON 的出错位置等信息只在这里
    throw new Error(`${path} 不是合法 JSON：${(error as Error).message}`, { cause: error })
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error(
      `${path} 不是覆盖率摘要：顶层应是一个对象（istanbul / c8 / vitest 的 json-summary）`,
    )
  }
  const record = raw as Record<string, unknown>
  if (!isSummaryEntry(record.total)) {
    const isRaw = Object.values(record).some(
      (entry) =>
        typeof entry === 'object' &&
        entry !== null &&
        RAW_COVERAGE_KEYS.some((key) => key in (entry as Record<string, unknown>)),
    )
    throw new Error(
      isRaw
        ? `${path} 是 istanbul 的**原始**格式（coverage-final.json），本工具只认**摘要**：` +
            '请改用摘要报告（vitest `--coverage.reporter=json-summary` / c8 `--reporter=json-summary`）'
        : `${path} 不是覆盖率摘要：要的是 istanbul / c8 / vitest 的 coverage-summary.json` +
            '（顶层有 total，每个文件有 lines / branches / functions / statements 的 pct）',
    )
  }
  const files: CoverageEntry[] = []
  for (const [key, entry] of Object.entries(record)) {
    if (key === 'total') continue
    if (!isSummaryEntry(entry)) {
      throw new Error(
        `${path} 的 ${key} 不是覆盖率条目（缺 lines / branches / functions / statements 的 pct）—— 指错文件了？`,
      )
    }
    const metrics = entry as IstanbulEntry
    files.push({
      rel: relativize(key, root),
      lines: pct(metrics.lines),
      branches: pct(metrics.branches),
      functions: pct(metrics.functions),
      statements: pct(metrics.statements),
    })
  }
  return { path, format: 'istanbul-json', mtimeMs, files }
}

/**
 * Node 覆盖率表格：`file | line % | branch % | funcs % | uncovered lines`，缩进表示树层级。
 *
 * 两条判据（R-147）：
 * - **前缀随 Node 版本变**：24 是 `ℹ `、22 是 `# ` —— 只去掉前缀本身、**保留缩进**（缩进才是树层级）。
 *   旧实现只剥 `ℹ`，于是在 Node 22（`engines` 下限）上解出 `"#  engine/#   a.mjs"` 这种全错路径，且一条不报。
 * - **文件行 = 前三列都是数字**：目录行**没有**数字（Node 22.18.0 与 24.13.0 实测一致），
 *   带数字的 `all files` 汇总行显式排除。
 *
 * 为什么不再按扩展名白名单判：白名单漏一个扩展名（`.mts` / `.cts` / `.svelte`…）就会把**文件行**当目录压栈 ——
 * 那个文件自己消失，**它后面每一行的路径都被它污染**（实测 `src/b.cts/c.tsx`），而且每加一种源码形态都要改这里。
 */
function parseNodeTable(text: string, path: string, mtimeMs: number): CoverageReport {
  const files: CoverageEntry[] = []
  const stack: { depth: number; name: string }[] = []
  /** 见过表格行吗：没有表格也没有 JSON = 指错文件了（R-152：读不懂就报，不静默给空集） */
  let sawTable = false
  for (const line of text.split('\n')) {
    // `ℹ `（Node 24）/ `# `（Node 22）：只剥前缀本身，缩进留给下面的深度判断
    const body = line.replace(/^\s*[ℹ#]\s?/, '')
    if (!body.includes('|')) continue
    const cells = body.split('|')
    if (cells.length < 5) continue
    sawTable = true
    const label = cells[0] ?? ''
    const name = label.trim()
    if (name === '' || name === 'file' || name.startsWith('-----') || name === 'all files') continue
    // 第 4 列是「未覆盖行号」，经常为空或是 `12-15` 这种区间，所以只按前三列（行 / 分支 / 函数）判
    const numbers = cells.slice(1, 4).map((cell) => Number.parseFloat(cell.trim()))
    if (!numbers.every((value) => Number.isFinite(value))) {
      // 目录行：按缩进维护栈（Node 的树形输出靠缩进表达层级）
      const depth = label.length - label.trimStart().length
      while (stack.length > 0 && (stack[stack.length - 1] as { depth: number }).depth >= depth)
        stack.pop()
      stack.push({ depth, name })
      continue
    }
    const dirs = stack.map((item) => item.name)
    files.push({
      rel: [...dirs, name].join('/').replace(/^\/+/, ''),
      lines: numbers[0] as number,
      branches: numbers[1] as number,
      functions: numbers[2] as number,
      statements: numbers[0] as number,
    })
  }
  if (!sawTable) {
    throw new Error(
      `${path} 不是覆盖率产物：既不是 JSON 摘要（istanbul / c8 / vitest 的 coverage-summary.json），` +
        '也不是 Node 覆盖率表格（`node --test --experimental-test-coverage` 的输出）—— 指错文件了？',
    )
  }
  return { path, format: 'node-table', mtimeMs, files }
}

export function readCoverageReport(path: string, root: string): CoverageReport {
  const text = readFileSync(path, 'utf8')
  const mtimeMs = statSync(path).mtimeMs
  const head = text.trimStart()
  /**
   * JSON（摘要，或"以为自己是摘要"的东西）一律走 JSON 分支 —— **认不出来会在那里抛错**（R-152）。
   * 判据放宽到 `{` 与 `[`：数组也是 JSON，进去才能拿到"不是覆盖率摘要"这句人话，而不是静默给空集。
   */
  if (head.startsWith('{') || head.startsWith('[')) return parseIstanbul(text, path, root, mtimeMs)
  return parseNodeTable(text, path, mtimeMs)
}

/** 按 glob 聚合（用于目录级下限）：返回命中文件的加权平均值 */
export function aggregate(
  report: CoverageReport,
  match: (rel: string) => boolean,
): { files: number; lines: number; branches: number; functions: number } | null {
  const hit = report.files.filter((file) => match(file.rel))
  if (hit.length === 0) return null
  const mean = (pick: (entry: CoverageEntry) => number): number =>
    hit.reduce((sum, entry) => sum + pick(entry), 0) / hit.length
  return {
    files: hit.length,
    lines: mean((entry) => entry.lines),
    branches: mean((entry) => entry.branches),
    functions: mean((entry) => entry.functions),
  }
}
