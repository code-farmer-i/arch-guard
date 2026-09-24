import assert from 'node:assert/strict'
import { test } from 'node:test'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { coreRules } from '../es/index.js'
import { runSelfTest } from '../es/engine/self-test.js'

/** 夹具根目录（测试文件在 tests/ 下） */
const PACKAGE_ROOT = fileURLToPath(new URL('..', import.meta.url))

test('夹具回归在测试进程内跑：每条规则的违规必报与合规不报都被覆盖', async () => {
  const result = await runSelfTest(PACKAGE_ROOT, coreRules)
  assert.ok(result.total >= 11, `夹具数量异常：${result.total}`)
  assert.equal(
    result.failures.length,
    0,
    `夹具失败：\n${result.failures.map((item) => `  ${item.fixture}: ${item.message}`).join('\n')}`,
  )
  assert.equal(result.passed, result.total)
})

test('夹具覆盖了全部已实现规则（防「加了规则没加夹具」）', async () => {
  const covered = new Set()
  const { readFileSync, readdirSync } = await import('node:fs')
  const root = join(PACKAGE_ROOT, '__fixtures__')
  for (const name of readdirSync(root)) {
    try {
      const expect = JSON.parse(readFileSync(join(root, name, 'expect.json'), 'utf8'))
      for (const finding of expect.findings ?? []) covered.add(finding.rule)
      // 有些规则只能在带 git / 缺失产物这类条件下触发，由单测覆盖（夹具里显式声明，别悄悄漏）
      for (const id of expect.unitOnly ?? []) covered.add(id)
    } catch {
      /* 没有 expect.json 的夹具目录跳过 */
    }
  }
  const missing = coreRules.map((rule) => rule.id).filter((id) => !covered.has(id))
  assert.deepEqual(missing, [], `这些规则没有「违规必报」夹具：${missing.join(', ')}`)
})
