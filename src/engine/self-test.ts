import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { runGuard } from './run.js'
import type { Rule } from './types.js'

/**
 * 夹具回归：每条规则一对「违规必报 × 合规不报」样例。
 * 规则改一次就必须有回归，否则会悄悄失效（见 docs/DESIGN.md §6.7）。
 */

export interface FixtureExpectation {
  findings?: { rule: string; file: string }[]
  exact?: boolean
}

export interface SelfTestResult {
  total: number
  passed: number
  failures: { fixture: string; message: string }[]
}

export async function runSelfTest(packageRoot: string, rules: Rule[]): Promise<SelfTestResult> {
  const fixturesRoot = join(packageRoot, '__fixtures__')
  if (!existsSync(fixturesRoot)) return { total: 0, passed: 0, failures: [] }

  const fixtures = readdirSync(fixturesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()

  const failures: SelfTestResult['failures'] = []
  let passed = 0

  for (const fixture of fixtures) {
    const dir = join(fixturesRoot, fixture)
    const expectationPath = join(dir, 'expect.json')
    if (!existsSync(expectationPath)) {
      failures.push({ fixture, message: '缺少 expect.json' })
      continue
    }
    const expectation = JSON.parse(readFileSync(expectationPath, 'utf8')) as FixtureExpectation
    const expected = expectation.findings ?? []

    let actual: string[]
    try {
      const result = await runGuard({ cwd: dir, rules, quiet: true })
      actual = result.all.map((finding) => `${finding.rule} ${finding.file}`)
    } catch (error) {
      failures.push({ fixture, message: `引擎异常：${(error as Error).message}` })
      continue
    }

    const expectedSet = new Set(expected.map((entry) => `${entry.rule} ${entry.file}`))
    const actualSet = new Set(actual)
    const missing = [...expectedSet].filter((entry) => !actualSet.has(entry))
    const extra =
      expectation.exact === true ? [...actualSet].filter((entry) => !expectedSet.has(entry)) : []

    if (missing.length > 0 || extra.length > 0) {
      const parts: string[] = []
      if (missing.length > 0) parts.push(`未报出：${missing.join(', ')}`)
      if (extra.length > 0) parts.push(`多报出：${extra.join(', ')}`)
      failures.push({ fixture, message: parts.join('；') })
      continue
    }
    passed += 1
  }

  return { total: fixtures.length, passed, failures }
}
