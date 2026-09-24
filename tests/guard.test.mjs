import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

import { runGuard, coreRules } from '../es/index.js'

const PACKAGE_ROOT = fileURLToPath(new URL('..', import.meta.url))

const run = (fixture, options = {}) =>
  runGuard({
    cwd: `${PACKAGE_ROOT}__fixtures__/${fixture}`,
    rules: coreRules,
    quiet: true,
    ...options,
  })

test('合规夹具：零误报', async () => {
  const result = await run('clean')
  assert.deepEqual(result.all, [])
  assert.equal(result.exitCode, 0)
})

test('违规夹具：该报的违规全部报出，且没有多报', async () => {
  const result = await run('violations')
  const actual = result.all.map((finding) => `${finding.rule} ${finding.file}`).sort()
  assert.deepEqual(actual, [
    'S01 src/orphans/thing.ts',
    'S11 src/shared/lib/helpers.ts',
    'S12 src/modules/crews/views/Bad.tsx',
    'S13 src/modules/crews/views/Bad.tsx',
    'S13 src/shared/lib/helpers.ts',
    'S14 src/modules/crews/views/Bad.tsx',
    'S15 src/shared/lib/helpers.ts', // 该文件不可达（合成夹具里没有入口引用它）
    'S33 src/shared/lib/helpers.ts', // barrel 指向不存在的文件（悬空说明符，故意留的）
  ])
  assert.equal(result.exitCode, 1)
})

test('解析失败 fail-closed：坏语法必须报 S00 而不是静默通过', async () => {
  const result = await run('parse-error')
  assert.ok(result.all.some((finding) => finding.rule === 'S00'))
  assert.equal(result.exitCode, 1)
})

test('报告过滤：--domain 只跑指定域的规则', async () => {
  // violations 夹具里的 hygiene 类规则已委派给 eslint，改用仍带 H 域命中的 rules 夹具
  const result = await run('hygiene-context', { domain: ['hygiene'] })
  const rules = new Set(result.all.map((finding) => finding.rule))
  assert.deepEqual([...rules].sort(), ['H06'])
})

test('报告过滤：--min-level=L1 只跑路径级规则', async () => {
  const result = await run('violations', { minLevel: 'L1' })
  const rules = new Set(result.all.map((finding) => finding.rule))
  assert.deepEqual([...rules].sort(), ['S01', 'S12', 'S14'])
})

test('报告过滤：--severity=warn 在没有 warn 规则时不报 error', async () => {
  const result = await run('violations', { severity: 'warn' })
  assert.deepEqual(result.active, [])
})

test('scope=changed 不会丢掉不可归属的全局违规（防假绿）', async () => {
  const result = await run('violations', { scope: 'changed' })
  assert.ok(
    result.active.some((finding) => finding.global),
    '全局违规必须保留',
  )
  assert.ok(result.all.length > 0)
})

test('scope=changed + --local-only 才允许跳过全局违规', async () => {
  const result = await run('violations', { scope: 'changed', localOnly: true })
  assert.equal(result.active.filter((finding) => finding.global).length, 0)
})
