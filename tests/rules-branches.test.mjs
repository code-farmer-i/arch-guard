import assert from 'node:assert/strict'
import { test } from 'node:test'

import { extractFacts } from '../es/engine/facts.js'
import { reactRules } from '../es/packs/react/index.js'

/** 造一个够用的规则上下文：只填被测规则真正会读的字段 */
function makeContext({
  files = {},
  records,
  params = {},
  adapters = {},
  i18n,
  scan,
  roles = [],
  layout = { app: 'src/app', modules: 'src/modules', shared: 'src/shared' },
} = {}) {
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
      layout,
      roles,
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
      ...scan,
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

test('S01 / S03：提示要指路（闭集枚举只说"你错了"没用，要说"放哪"）', () => {
  const s01 = reactRules.find((rule) => rule.id === 'S01')
  const s03 = reactRules.find((rule) => rule.id === 'S03')
  assert.ok(s01 && s03)

  const scanFor = (missing) => ({
    records: [],
    files: [],
    missing,
    ambiguous: [],
    exempted: [],
    outside: [],
    foreign: [],
  })

  const app = s01.run(makeContext({ scan: scanFor(['src/app/providers.tsx']) }))
  assert.match(app[0]?.hint ?? '', /App\.tsx/, 'app 层装配件要指到 App.tsx')
  assert.match(app[0]?.hint ?? '', /shared\//, '配置对象要指到 shared/')

  // 域根散件由 S03 报（S01 会跳过，避免同一处报两遍）
  const straySlot = s01.run(makeContext({ scan: scanFor(['src/modules/crews/screens/Home.tsx']) }))
  assert.match(straySlot[0]?.hint ?? '', /七个槽位/, '没登记的槽位要念出闭集')

  const sharedUi = s01.run(makeContext({ scan: scanFor(['src/shared/components/Button.tsx']) }))
  assert.match(
    sharedUi[0]?.hint ?? '',
    /ui\/.*common\/|ui\//,
    'shared/components 下要指到 ui/ 或 common/',
  )

  const root = s01.run(makeContext({ scan: scanFor(['src/features/x.ts']) }))
  assert.match(root[0]?.hint ?? '', /app\/ modules\/ shared\//, '域外文件要指回三根')

  // 库范式不说应用范式那套：layout.modules 为空时念出项目声明的目录表
  const libCtx = makeContext({
    scan: scanFor(['src/utils.ts']),
    layout: { app: 'src', modules: '', shared: '' },
    roles: [
      { id: 'lib:entry', pattern: 'src/index.ts', layer: 10, slot: 'entry' },
      { id: 'lib:shared', pattern: 'src/shared/**', layer: 1 },
      { id: 'lib:pages', pattern: 'src/pages/**', layer: 5 },
    ],
  })
  const libFinding = s01.run(libCtx)
  assert.match(libFinding[0]?.hint ?? '', /shared \/ pages/, '库范式要念出声明过的目录表')
  assert.doesNotMatch(libFinding[0]?.hint ?? '', /App\.tsx/, '库范式不该说 app 层那套')

  const s03Findings = s03.run(makeContext({ scan: scanFor(['src/modules/crews/types.ts']) }))
  assert.match(s03Findings[0]?.hint ?? '', /model\//, 'S03 对域根散件要指到 model/')
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
