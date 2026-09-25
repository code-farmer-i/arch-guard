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

test('deps-audit：没有 npm 包的 kit 也在表里（否则"配了 styles() 吗"看不见），并带上形态字段', () => {
  const adapters = {
    styles: {
      facet: 'styles',
      id: 'css-modules',
      specVersion: '1',
      packages: [],
      modulePatterns: ['\\.module\\.scss$'],
    },
    router: {
      facet: 'router',
      id: 'react-router',
      specVersion: '1',
      packages: ['react-router'],
      routeFiles: ['routes.ts', 'routes.tsx'],
      examples: { routeFiles: { hit: ['x'], miss: ['y'] } },
    },
  }
  const audit = auditAdapterDeps({ adapters }, deps(['react-router']))
  assert.equal(audit.rows.length, 2, '两个面都要有行')
  assert.equal(audit.ok, true, '没有包的方案不该被算成"缺包"')

  const styles = audit.rows.find((row) => row.facet === 'styles')
  assert.deepEqual(styles?.packages, [])
  assert.deepEqual(styles?.fields, [{ name: 'modulePatterns', value: '\\.module\\.scss$' }])
  assert.equal(styles?.specVersion, '1')

  const router = audit.rows.find((row) => row.facet === 'router')
  assert.deepEqual(
    router?.fields,
    [{ name: 'routeFiles', value: 'routes.ts / routes.tsx' }],
    '数组按 / 连；examples 不进表',
  )

  // 空清单是**声明**（"本方案没有这种文件"），排查时不能显示成一片空白
  const none = auditAdapterDeps(
    { adapters: { router: { facet: 'router', id: 'none', packages: [], routeFiles: [] } } },
    deps([]),
  )
  assert.deepEqual(none.rows[0]?.fields, [{ name: 'routeFiles', value: '（空）' }])
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
