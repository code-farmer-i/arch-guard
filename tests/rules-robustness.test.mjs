import assert from 'node:assert/strict'
import { test } from 'node:test'

import { reactRules } from '../es/packs/react/index.js'

/**
 * 空项目上下文：没有记录、没有事实、没有图、没有 i18n、没有适配器。
 * 规则在这种「什么都没有」的仓库里必须安静通过 —— 早退分支写错会让新项目第一次接入就崩。
 */
function emptyContext() {
  return {
    config: {
      root: '/tmp/empty-project',
      srcRoot: 'src',
      params: {},
      adapters: {},
      naming: { hookPrefix: 'use', viewSuffix: 'Page', pageComponentSuffix: 'Page' },
      thresholds: {
        fileLines: 500,
        viewLines: 500,
        functionLines: 150,
        exportsPerFile: 6,
        componentsPerFile: 3,
      },
      layout: { app: 'src/app', modules: 'src/modules', shared: 'src/shared' },
      entries: [],
      ignore: [],
      aliases: {},
    },
    records: [],
    facts: new Map(),
    graph: {
      edges: new Map(),
      importers: new Map(),
      externals: new Map(),
      unresolved: new Map(),
      reachable: new Set(),
      orphaned: [],
      cycles: [],
    },
    scan: { records: [], files: [], missing: [], ambiguous: [], exempted: [] },
    deps: { hasManifest: false, runtime: [], dev: [], peer: [], declared: new Set() },
    policy: { allow: [], deny: [], capabilities: {} },
    files: [],
    sourceOf: () => undefined,
  }
}

test('每条规则在空项目上都安静通过（早退分支的健壮性）', () => {
  const ctx = emptyContext()
  const noisy = []
  for (const rule of reactRules) {
    let findings
    try {
      findings = rule.run(ctx)
    } catch (error) {
      throw new Error(`${rule.id}（${rule.title}）在空项目上抛异常：${error.message}`, {
        cause: error,
      })
    }
    if (findings.length > 0) noisy.push(`${rule.id}(${findings.length})`)
  }
  assert.deepEqual(noisy, [], `空项目上不该有任何发现：${noisy.join(', ')}`)
})

test('规则契约：id 唯一、都有 title/hint、error 级必须在 L1–L3', () => {
  const seen = new Set()
  for (const rule of reactRules) {
    assert.equal(seen.has(rule.id), false, `规则 id 重复：${rule.id}`)
    seen.add(rule.id)
    assert.ok(rule.title.length > 0, `${rule.id} 缺 title`)
    assert.ok(rule.hint.length > 0, `${rule.id} 缺 hint（要告诉人怎么改）`)
    assert.ok(['S', 'D', 'C', 'P', 'H'].includes(rule.id[0]), `${rule.id} 的域前缀不合法`)
    if (rule.severity === 'error') {
      assert.ok(['L1', 'L2', 'L3'].includes(rule.level), `${rule.id} 是 error 却落在 ${rule.level}`)
    }
    assert.equal(typeof rule.run, 'function')
  }
  assert.ok(reactRules.length >= 62, `规则数不应该低于 62，实际 ${reactRules.length}`)
})
