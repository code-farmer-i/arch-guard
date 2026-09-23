import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  checkPortability,
  createRegistry,
  createRule,
  depsPolicyFrom,
  loadConfig,
  policyConflicts,
} from '../es/index.js'

const stubRule = (id, requires = []) =>
  createRule({ id: `H${id}`, domain: 'hygiene', level: 'L2', title: id, requires, run: () => [] })

const PACKAGE_ROOT = fileURLToPath(new URL('..', import.meta.url))

/* ---------------- 注册表：能力协商 ---------------- */

test('registry：能力未声明的规则不注册，并给出原因', () => {
  const config = { adapters: {}, enable: 'all', params: {} }
  const result = createRegistry([stubRule('01', ['uiKit.vendorSelectors']), stubRule('02')], config)
  assert.deepEqual(
    result.enabled.map((rule) => rule.id),
    ['H02'],
  )
  assert.deepEqual(result.skipped, [{ rule: 'H01', reason: '能力未声明：uiKit.vendorSelectors' }])
})

test('registry：启用名单、未知 id、以及 only/domain/level 过滤', () => {
  const config = { adapters: {}, enable: ['H01', 'NOPE'], params: {} }
  const rules = [stubRule('01'), stubRule('02')]
  const result = createRegistry(rules, config)
  assert.deepEqual(
    result.enabled.map((rule) => rule.id),
    ['H01'],
  )
  assert.deepEqual(result.unknownEnabled, ['NOPE'])
  assert.deepEqual(
    createRegistry(rules, { ...config, enable: 'all' }, { only: ['H02'] }).enabled.map((r) => r.id),
    ['H02'],
  )
  assert.deepEqual(
    createRegistry(rules, { ...config, enable: 'all' }, { domain: ['structure'] }).enabled,
    [],
  )
  assert.deepEqual(
    createRegistry(rules, { ...config, enable: 'all' }, { minLevel: 'L1' }).enabled,
    [],
  )
})

/* ---------------- 配置 ---------------- */

test('config：缺文件 / 缺 layout / 缺 roles 都是明确报错（不回退猜测）', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ag-config-'))
  await assert.rejects(loadConfig({ root: dir }), /找不到配置文件/)
  writeFileSync(
    join(dir, 'arch.config.mjs'),
    'export default { presets: [{ layout: { app: "a", modules: "m", shared: "s" } }] }',
  )
  await assert.rejects(loadConfig({ root: dir }), /没有角色表/)
  writeFileSync(
    join(dir, 'arch.config.mjs'),
    'export default { presets: [{ roles: [{ id: "x", pattern: "a/**", layer: 1 }] }] }',
  )
  await assert.rejects(loadConfig({ root: dir }), /没有 layout/)
})

test('config：tsconfig 别名与 index.html 入口被自动纳入', async () => {
  const { config } = await loadConfig({ root: `${PACKAGE_ROOT}examples/minimal` })
  assert.equal(config.aliases['@'], 'src')
  assert.ok(config.entries.includes('src/index.ts') || config.entries.includes('src/app/main.tsx'))
})

/* ---------------- 本体自包含：失败分支 ---------------- */

test('portability：P1 非白名单依赖 / P2 宿主字面量 / P3 引擎布局假设都会被抓', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ag-port-'))
  mkdirSync(join(dir, 'src/engine'), { recursive: true })
  writeFileSync(
    join(dir, 'src/engine/a.ts'),
    "import lodash from 'lodash'\nconst host = 'superhive'\nconst p = 'src/app'\n",
  )
  const result = checkPortability(dir)
  const rules = result.findings.map((finding) => finding.rule).sort()
  assert.deepEqual([...new Set(rules)], ['P1', 'P2', 'P3'])
})

/* ---------------- 依赖策略 ---------------- */

test('deps：策略解析忽略非法值、冲突检测覆盖 deny 与 allow', () => {
  const policy = depsPolicyFrom({ allow: ['a', 1], deny: 'x', capabilities: { k: 'v', bad: 2 } })
  assert.deepEqual(policy.allow, ['a'])
  assert.deepEqual(policy.deny, [])
  assert.deepEqual(policy.capabilities, { k: 'v' })
  assert.match(
    policyConflicts(depsPolicyFrom({ deny: ['v'], capabilities: { k: 'v' } }))[0] ?? '',
    /deny/,
  )
})

/* ---------------- CLI ---------------- */

test('cli：非法取值退出码 2，help/version 退出码 0', async () => {
  const { run } = await import('../es/cli.js')
  assert.equal(await run(['--domain', 'Z']), 2)
  assert.equal(await run(['--min-level', 'L9']), 2)
  assert.equal(await run(['--severity', 'fatal']), 2)
  assert.equal(await run(['--format', 'xml']), 2)
  assert.equal(await run(['--nope']), 2)
  assert.equal(await run(['--help']), 0)
  assert.equal(await run(['--version']), 0)
})

test('cli：commander 注册了全部对外开关（防止重构时丢参数）', async () => {
  const { createProgram } = await import('../es/cli.js')
  const options = createProgram()
    .options.map((option) => option.long)
    .sort()
  assert.deepEqual(options, [
    '--config',
    '--domain',
    '--format',
    '--local-only',
    '--min-level',
    '--only',
    '--paths',
    '--report-only',
    '--scope',
    '--self-check-portability',
    '--self-test',
    '--severity',
    '--update-baseline',
    '--version',
  ])
})

test('typescript 版本自检：缺 API 的版本给出可执行报错（而不是 undefined 崩）', async () => {
  const { assertTypeScriptApi, describeTypeScriptProblem } = await import('../es/engine/ts-api.js')
  assert.equal(describeTypeScriptProblem({ createSourceFile: () => {}, ScriptKind: {} }), null)
  assert.match(describeTypeScriptProblem({}) ?? '', /createSourceFile \/ ScriptKind/)
  assert.match(describeTypeScriptProblem({ createSourceFile: () => {} }) ?? '', /ScriptKind/)
  assert.throws(() => assertTypeScriptApi({}), /typescript >=5.4 <7/)
  assert.doesNotThrow(() => assertTypeScriptApi({ createSourceFile: () => {}, ScriptKind: {} }))
})

test('阈值：默认 500 行，且可按项目覆盖', async () => {
  const { config } = await loadConfig({ root: `${PACKAGE_ROOT}examples/minimal` })
  assert.equal(config.thresholds.fileLines, 500)
  assert.equal(config.thresholds.viewLines, 500)
  assert.equal(config.thresholds.functionLines, 150)

  const { config: tight } = await loadConfig({ root: `${PACKAGE_ROOT}__fixtures__/rules` })
  assert.equal(tight.thresholds.fileLines, 40, '夹具覆盖了阈值')
})

test('manifest：运行时依赖不得被误删（commander 只在 es/ 里被 import，漏装即运行时崩溃）', () => {
  const pkg = JSON.parse(readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf8'))
  assert.deepEqual(Object.keys(pkg.dependencies ?? {}), ['commander'], '运行时依赖清单被改动过？')
  assert.equal(pkg.peerDependencies.typescript, '>=5.4.0 <7', 'peer 范围必须排除 typescript@7')
})
