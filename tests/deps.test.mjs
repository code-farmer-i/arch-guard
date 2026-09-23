import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

import {
  depsPolicyFrom,
  policyConflicts,
  readProjectDeps,
  reactRules,
  runGuard,
} from '../es/index.js'

const PACKAGE_ROOT = fileURLToPath(new URL('..', import.meta.url))

const run = (fixture, options = {}) =>
  runGuard({
    cwd: `${PACKAGE_ROOT}__fixtures__/${fixture}`,
    rules: reactRules,
    quiet: true,
    ...options,
  })

test('依赖策略：deny 与能力首选冲突必须报出来', () => {
  const policy = depsPolicyFrom({ deny: ['dayjs'], capabilities: { datetime: 'dayjs' } })
  const conflicts = policyConflicts(policy)
  assert.equal(conflicts.length, 1)
  assert.match(conflicts[0], /datetime/)
})

test('依赖策略：能力首选必须在 allow 白名单里', () => {
  const conflicts = policyConflicts(
    depsPolicyFrom({ allow: ['zod'], capabilities: { datetime: 'dayjs' } }),
  )
  assert.ok(conflicts.some((item) => item.includes('不在 allow')))
})

test('依赖事实：Node 内置模块不算幽灵依赖', () => {
  const deps = readProjectDeps(`${PACKAGE_ROOT}examples/minimal`, [
    'node:fs',
    'fs',
    'node:test',
    'left-pad',
  ])
  assert.deepEqual(deps.phantom, ['left-pad'])
})

test('平台内置能力不要求在 allow 白名单里（不是依赖）', () => {
  const policy = depsPolicyFrom({
    allow: ['commander'],
    capabilities: { 'deep-clone': 'structuredClone' },
  })
  assert.deepEqual(policyConflicts(policy, ['deep-clone']), [])
  // 不告诉它这是平台能力，就会当成缺失的依赖 → 报冲突
  assert.equal(policyConflicts(policy).length, 1)
})

test('P 域：注释里写的指纹不算（注释遮罩生效）', async () => {
  const result = await run('deps')
  const mentions = result.all.filter((finding) => /deep-clone|structuredClone/.test(finding.text))
  assert.deepEqual(mentions, [])
})

test('P 域：违规夹具报出四条 error 与一条 warn', async () => {
  const result = await run('deps')
  const byRule = new Map()
  for (const finding of result.all) byRule.set(finding.rule, (byRule.get(finding.rule) ?? 0) + 1)
  assert.deepEqual([...byRule.entries()].sort(), [
    ['P01', 1], // left-pad 未登记
    ['P02', 1], // axios 被禁用
    ['P03', 1], // some-undeclared-pkg 幽灵依赖
    ['P06', 1], // 手搓 process.argv，且没在用登记的 commander
    ['P08', 1], // 登记了 commander 却零引用（warn）
  ])
})

test('P 域：手搓日期格式化被抓，而正确使用 dayjs 的文件不报', async () => {
  const result = await run('datetime')
  const p06 = result.all.filter((finding) => finding.rule === 'P06')
  assert.equal(p06.length, 1)
  assert.equal(p06[0].file, 'src/app/main.tsx')
  assert.match(p06[0].text, /另有 5 处/)
  // 正确使用 dayjs 的文件不该被 P06 点名（别的规则可能因为它不可达而报 S15，这里只看 P06）
  assert.equal(
    result.all.some((finding) => finding.rule === 'P06' && finding.file.includes('time.ts')),
    false,
  )
})

test('P 域：命中指纹但确实在用登记方案时不报（本体即正例）', async () => {
  // 本体用 process.argv.slice（命中 cli-args 强指纹），同时真的 import 了 commander → P06 不该报
  const result = await runGuard({ cwd: PACKAGE_ROOT, rules: reactRules, quiet: true })
  const deps = result.all.filter((finding) => finding.rule.startsWith('P'))
  assert.deepEqual(
    deps.map((finding) => `${finding.rule} ${finding.text}`),
    [],
  )
})
