import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

import {
  AdapterError,
  RuleDefinitionError,
  checkPortability,
  createRule,
  defineAdapter,
  loadConfig,
  scanProject,
} from '../es/index.js'

const PACKAGE_ROOT = fileURLToPath(new URL('..', import.meta.url))

test('适配器：未知字段直接报错（防静默失能）', () => {
  assert.throws(
    () => defineAdapter('ui-kit', { id: 'x', packages: [], vendorSelector: ['\\.x-'] }),
    (error) => error instanceof AdapterError && /未知字段/.test(error.message),
  )
})

test('适配器：examples 的 hit 必须真的被声明命中', () => {
  assert.throws(
    () =>
      defineAdapter('ui-kit', {
        id: 'x',
        packages: [],
        vendorSelectors: ['\\.x-'],
        examples: { vendorSelectors: { hit: ['.y-btn'], miss: ['.x-btn'] } },
      }),
    (error) => error instanceof AdapterError,
  )
})

test('适配器：合法声明被冻结', () => {
  const adapter = defineAdapter('ui-kit', { id: 'x', packages: [] })
  assert.equal(Object.isFrozen(adapter), true)
})

test('规则契约：error 级不许落在 L4（语义判据不进红线）', () => {
  assert.throws(
    () =>
      createRule({
        id: 'D01',
        domain: 'design',
        level: 'L4',
        title: 'x',
        run: () => [],
      }),
    (error) => error instanceof RuleDefinitionError && /L1–L3/.test(error.message),
  )
})

test('规则契约：id 前缀必须与域一致', () => {
  assert.throws(
    () => createRule({ id: 'D01', domain: 'hygiene', level: 'L2', title: 'x', run: () => [] }),
    (error) => error instanceof RuleDefinitionError,
  )
})

test('结构：示例工程的每个文件恰好命中一个角色', async () => {
  const { config } = await loadConfig({ root: `${PACKAGE_ROOT}examples/minimal` })
  const scan = scanProject(config)
  assert.deepEqual(scan.missing, [])
  assert.deepEqual(scan.ambiguous, [])
  assert.ok(scan.records.length > 0)
  for (const record of scan.records) assert.ok(record.role.length > 0, `${record.rel} 没有角色`)
})

test('结构：别名取自项目自己的 tsconfig', async () => {
  const { config } = await loadConfig({ root: `${PACKAGE_ROOT}examples/minimal` })
  assert.equal(config.aliases['@'], 'src')
})

test('本体自包含：P1–P4 全过', () => {
  const result = checkPortability(PACKAGE_ROOT)
  assert.deepEqual(
    result.findings.map((finding) => `${finding.rule} ${finding.file}`),
    [],
  )
  assert.ok(result.checked > 0)
})

test('defineSourceForm：形态 id 必须在数据表里、规则不许空、同一份集里 id 不许冲突', async () => {
  const { defineSourceForm, SourceFormError } = await import('../es/index.js')
  const rule = (id) => ({
    id,
    domain: 'structure',
    level: 'L1',
    severity: 'error',
    title: `t${id}`,
    run: () => [],
  })
  const binding = defineSourceForm({ id: 'react', rules: [rule('S01'), rule('S02')], adapters: [] })
  assert.equal(binding.id, 'react')
  assert.equal(Object.isFrozen(binding), true)

  // 形态必须在数据表里登记过（否则报错时连扩展名都说不出来）
  assert.throws(
    () => defineSourceForm({ id: 'demo', rules: [rule('S01')], adapters: [] }),
    /不在 data\/framework-sources.ts 的形态表里/,
  )
  assert.throws(
    () => defineSourceForm({ id: '', rules: [rule('S01')], adapters: [] }),
    SourceFormError,
  )
  assert.throws(() => defineSourceForm({ id: 'react', rules: [], adapters: [] }), SourceFormError)
  assert.throws(
    () =>
      defineSourceForm({
        id: 'react',
        rules: [rule('S01'), { ...rule('S01'), title: '另一条' }],
        adapters: [],
      }),
    /规则 id 重复/,
  )
})
