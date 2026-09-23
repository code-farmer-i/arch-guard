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

/** 把 istanbul 的绝对路径换算成配置根相对路径；换不了就原样保留 */
function relativize(rawPath: string, root: string): string {
  if (!rawPath.startsWith('/')) return rawPath
  const prefix = root.endsWith('/') ? root : `${root}/`
  return rawPath.startsWith(prefix) ? rawPath.slice(prefix.length) : rawPath
}

function parseIstanbul(text: string, path: string, root: string, mtimeMs: number): CoverageReport {
  const raw = JSON.parse(text) as Record<string, IstanbulEntry>
  const files: CoverageEntry[] = []
  for (const [key, entry] of Object.entries(raw)) {
    if (key === 'total') continue
    files.push({
      rel: relativize(key, root),
      lines: pct(entry.lines),
      branches: pct(entry.branches),
      functions: pct(entry.functions),
      statements: pct(entry.statements),
    })
  }
  return { path, format: 'istanbul-json', mtimeMs, files }
}

/** Node 覆盖率表格：|---| 分隔行、`all files` 汇总行、缩进表示树层级 */
function parseNodeTable(text: string, path: string, mtimeMs: number): CoverageReport {
  const files: CoverageEntry[] = []
  const stack: { depth: number; name: string }[] = []
  for (const line of text.split('\n')) {
    const body = line.replace(/^ℹ\s?/, '')
    if (!body.includes('|')) continue
    const cells = body.split('|')
    if (cells.length < 5) continue
    const label = cells[0] ?? ''
    const name = label.trim()
    if (name === '' || name === 'file' || name.startsWith('-----')) continue
    // 第 4 列是「未覆盖行号」，经常为空，所以只按前三列（行/分支/函数）判是不是文件行
    const numbers = cells.slice(1, 4).map((cell) => Number.parseFloat(cell.trim()))
    const isFile =
      /\.(js|mjs|cjs|ts|tsx|vue|jsx)$/.test(name) &&
      numbers.every((value) => Number.isFinite(value))
    if (!isFile) {
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
  return { path, format: 'node-table', mtimeMs, files }
}

export function readCoverageReport(path: string, root: string): CoverageReport {
  const text = readFileSync(path, 'utf8')
  const mtimeMs = statSync(path).mtimeMs
  if (text.trimStart().startsWith('{')) return parseIstanbul(text, path, root, mtimeMs)
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
