import assert from 'node:assert/strict'
import { test } from 'node:test'

import { auditAdapterDeps, describePolicy } from '../es/engine/deps-audit.js'

const deps = (names) => ({
  hasManifest: true,
  runtime: names,
  dev: [],
  peer: [],
  declared: new Set(names),
})

test('deps-audit：适配表声明的包必须都装上', () => {
  const adapters = {
    'ui-kit': { facet: 'ui-kit', id: 'antd', packages: ['antd', '@ant-design/x'] },
  }
  const ok = auditAdapterDeps({ adapters }, deps(['antd', '@ant-design/x']))
  assert.equal(ok.ok, true)
  assert.deepEqual(
    ok.rows[0]?.packages.map((item) => item.declared),
    [true, true],
  )

  const missing = auditAdapterDeps({ adapters }, deps(['antd']))
  assert.equal(missing.ok, false)
  assert.deepEqual(missing.rows[0]?.packages[1], { name: '@ant-design/x', declared: false })
})

test('deps-audit：反向查出「装了适配表之外的组件库」', () => {
  const adapters = { 'ui-kit': { facet: 'ui-kit', id: 'antd', packages: ['antd'] } }
  const audit = auditAdapterDeps({ adapters }, deps(['antd', 'element-plus', 'zustand']))
  assert.equal(audit.ok, false)
  assert.deepEqual(audit.foreign, ['element-plus'], 'zustand 不是组件库，不该报')
})

test('deps-audit：i18n 面用 from 字段，没有适配器时表为空且通过', () => {
  const adapters = { i18n: { facet: 'i18n', id: 'i18next', from: ['i18next'] } }
  const audit = auditAdapterDeps({ adapters }, deps(['i18next']))
  assert.equal(audit.rows[0]?.facet, 'i18n')
  assert.equal(audit.ok, true)

  const empty = auditAdapterDeps({ adapters: {} }, deps([]))
  assert.deepEqual(empty.rows, [])
  assert.equal(empty.ok, true)
})

test('deps-audit：策略摘要把 allow/deny/能力首选都讲清楚', () => {
  const text = describePolicy({
    allow: ['commander'],
    deny: [],
    capabilities: { 'cli-args': 'commander' },
  })
  assert.match(text, /allow: commander/)
  assert.match(text, /deny: （无硬禁令）/)
  assert.match(text, /cli-args→commander/)
  assert.match(describePolicy({ allow: [], deny: ['axios'], capabilities: {} }), /未启用白名单/)
})
