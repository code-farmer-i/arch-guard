/**
 * oxc spike 的对照脚本（结论见 ./spec.md）。
 *
 * 只在**需要重新量一次**时跑，所以 oxc-parser 不是本仓库的依赖：
 *
 *   pnpm add -D oxc-parser        # spike 专用，量完可卸
 *   pnpm build                    # 脚本要 import es/engine/facts.js
 *   node .scratch/oxc-spike/compare.mjs <项目目录>
 *
 * 它只量「解析」这一步，不动现有 parser：同一批文件、3 轮取最小、先预热。
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { performance } from 'node:perf_hooks'
import { pathToFileURL } from 'node:url'

import ts from 'typescript'
import { parseSync } from 'oxc-parser'

const REPO = new URL('../../', import.meta.url)
const { extractFacts } = await import(new URL('es/engine/facts.js', REPO).href)

const root = process.argv[2]
if (!root) {
  console.error('用法：node .scratch/oxc-spike/compare.mjs <项目目录>')
  process.exit(2)
}

const EXTS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']
const SKIP = new Set([
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.git',
  '.turbo',
  '.arch-guard-cache',
])

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue
    const full = join(dir, name)
    const stat = statSync(full)
    if (stat.isDirectory()) walk(full, out)
    else if (EXTS.some((ext) => name.endsWith(ext))) out.push(full)
  }
  return out
}

const files = walk(root)
const sources = files.map((full) => ({
  full,
  rel: relative(root, full),
  text: readFileSync(full, 'utf8'),
}))
const bytes = sources.reduce((sum, file) => sum + Buffer.byteLength(file.text), 0)

const best = (rounds, fn) => {
  let min = Infinity
  for (let i = 0; i < rounds; i++) {
    const start = performance.now()
    fn()
    min = Math.min(min, performance.now() - start)
  }
  return min
}

parseSync(sources[0].full, sources[0].text)
ts.createSourceFile(
  sources[0].rel,
  sources[0].text,
  ts.ScriptTarget.Latest,
  false,
  ts.ScriptKind.TSX,
)

const tsMs = best(3, () => {
  for (const file of sources) {
    ts.createSourceFile(file.rel, file.text, ts.ScriptTarget.Latest, false, ts.ScriptKind.TSX)
  }
})
const oxcMs = best(3, () => {
  for (const file of sources) parseSync(file.full, file.text)
})
const factsMs = best(1, () => {
  for (const file of sources) {
    extractFacts({ file: file.full, rel: file.rel, role: '(spike)', text: file.text })
  }
})

const row = (label, ms) =>
  console.log(
    `  ${label.padEnd(28)} ${ms.toFixed(0).padStart(7)}ms   ${(sources.length / (ms / 1000))
      .toFixed(0)
      .padStart(6)} 文件/秒   ${(bytes / 1024 / 1024 / (ms / 1000)).toFixed(1).padStart(5)} MB/秒`,
  )

console.log(
  `${pathToFileURL(root).pathname}   ${sources.length} 个文件 / ${(bytes / 1024 / 1024).toFixed(1)} MB`,
)
row('ts.createSourceFile', tsMs)
row('oxc parseSync', oxcMs)
row('extractFacts（现状全量）', factsMs)
console.log(
  `  → oxc 比 TS 快 ${(tsMs / oxcMs).toFixed(1)}×；解析占 extractFacts ${(
    (tsMs / factsMs) *
    100
  ).toFixed(0)}%，所以换 parser 的端到端上界 ≈ ${(((tsMs - oxcMs) / factsMs) * 100).toFixed(0)}%`,
)
