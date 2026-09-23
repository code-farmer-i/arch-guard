import assert from 'node:assert/strict'
import { test } from 'node:test'

import { extractFacts } from '../es/engine/facts.js'
import { reactRules } from '../es/packs/react/index.js'

/** 造一个够用的规则上下文：只填被测规则真正会读的字段 */
function makeContext({ files = {}, records, params = {}, adapters = {}, i18n } = {}) {
  const facts = new Map()
  for (const [rel, text] of Object.entries(files)) {
    facts.set(rel, extractFacts({ file: rel, rel, role: 'tool', text }))
  }
  const byRel = new Map((records ?? [...facts.keys()]).map((rel) => [rel, rel]))
  return {
    config: {
      root: '/tmp/branches',
      srcRoot: 'src',
      params,
      adapters,
      naming: { hookPrefix: 'use', viewSuffix: 'Page' },
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
    records: [...byRel.keys()].map((rel) => ({
      rel,
      abs: `/tmp/branches/${rel}`,
      role: 'shared:lib',
      layer: 1,
      domain: null,
      slot: 'lib',
      kind: rel.endsWith('.css') ? 'css' : 'ts',
    })),
    facts,
    graph: {
      edges: new Map(),
      importers: new Map(),
      externals: new Map(),
      unresolved: new Map(),
      reachable: new Set(),
      orphaned: [],
      cycles: [],
    },
    scan: {
      records: [],
      files: [],
      missing: [],
      ambiguous: [],
      exempted: [],
      outside: [],
      foreign: [],
    },
    deps: { hasManifest: false, runtime: [], dev: [], peer: [], declared: new Set() },
    policy: { allow: [], deny: [], capabilities: {} },
    files: [...byRel.keys()],
    i18n,
    sourceOf: (rel) => files[rel],
  }
}

test('规则：有记录但事实缺失（解析失败的文件）时跳过而不是崩', () => {
  const records = ['src/shared/lib/broken.ts']
  const ctx = makeContext({ records, files: { 'unrelated.ts': 'export const x = 1' } })
  for (const rule of reactRules) {
    assert.doesNotThrow(() => rule.run(ctx), `${rule.id} 在没有 facts 时抛异常`)
  }
})

test('D 域：storage.ts 里找不到 htmlKeys 指定的键时明确报出来', () => {
  const files = {
    'src/shared/config/storage.ts': "export const STORAGE_KEYS = {\n  locale: 'app-locale',\n}\n",
    'index.html': '<script>localStorage.getItem("app-theme")</script>',
  }
  const ctx = makeContext({
    files,
    params: { storageFile: 'src/shared/config/storage.ts', htmlKeys: ['theme'] },
  })
  const findings = reactRules.find((rule) => rule.id === 'D08')?.run(ctx) ?? []
  assert.equal(findings.length, 1)
  assert.match(findings[0]?.text ?? '', /STORAGE_KEYS 里找不到 theme/)
})

test('D 域：对比度基线的令牌解析不了时跳过（不猜、不误报）', () => {
  const files = {
    'src/shared/styles/tokens/theme.css':
      ':root {\n  --sh-alias-fg: var(--sh-missing);\n}\n[data-theme="light"] {\n  --sh-alias-fg: #000000;\n}\n',
  }
  const ctx = makeContext({
    files,
    params: {
      themeFile: 'src/shared/styles/tokens/theme.css',
      tokenDir: 'src/shared/styles/tokens',
      themes: ['light'],
      contrastPairs: [
        { fg: '--sh-alias-fg', bg: '--sh-alias-missing-bg', usage: '测试', min: 4.5 },
      ],
    },
  })
  const findings = reactRules.find((rule) => rule.id === 'D07')?.run(ctx) ?? []
  assert.deepEqual(findings, [], '解析不了的配色要跳过，而不是报一个假对比度')
})
