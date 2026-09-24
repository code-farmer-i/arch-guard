import assert from 'node:assert/strict'
import { test } from 'node:test'

import { extractFacts } from '../es/engine/facts.js'
import { coreRules } from '../es/index.js'

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
  structure = { order: false, isolate: [], publicApi: [] },
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
      structure,
      entries: [],
      ignore: [],
      // 归一化后的 Config 一定有 include（S24 直接读它，不必防御）
      include: [],
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
  for (const rule of coreRules) {
    assert.doesNotThrow(() => rule.run(ctx), `${rule.id} 在没有 facts 时抛异常`)
  }
})

// 两条不同层的记录 + 一条向上的边（层号由角色描述符声明，不是从 layout 猜的）
function layeredContext({ order = false, isolate = [], publicApi = [], roles = [] } = {}) {
  const ctx = makeContext({ scan: {}, structure: { order, isolate, publicApi }, roles })
  const record = (rel, role, layer) => ({
    rel,
    abs: `/tmp/${rel}`,
    role,
    layer,
    domain: null,
    slot: null,
    captures: {},
    group: null,
    groupName: null,
    kind: 'ts',
  })
  ctx.records = [record('src/low/a.ts', 'low', 1), record('src/high/b.ts', 'high', 2)]
  ctx.graph = layeredGraph([['src/low/a.ts', ['src/high/b.ts']]])
  return ctx
}

function layeredGraph(pairs) {
  return {
    edges: new Map(pairs.map(([from, to]) => [from, new Set(to)])),
    importers: new Map(),
    externals: new Map(),
    unresolved: new Map(),
    reachable: new Set(),
    orphaned: [],
    cycles: [],
  }
}

test('S21：门控是声明（structure.order），不是猜 layout', () => {
  const rule = coreRules.find((item) => item.id === 'S21')
  assert.ok(rule)
  assert.equal(
    rule.run(layeredContext({ order: false })).length,
    0,
    '没声明 order → 不判（声明了才判，避免与别的规则重复报）',
  )
  assert.equal(rule.run(layeredContext({ order: true })).length, 1, '声明 order → 向上依赖必须报')
})

test('同一份引擎换范式：Atomic Design 的 atoms < molecules < organisms 也能表达（引擎零改动）', () => {
  const rule = coreRules.find((item) => item.id === 'S21')
  const ctx = makeContext({ scan: {}, structure: { order: true, isolate: [], publicApi: [] } })
  // 三个层的角色全部由**声明**给出 —— 引擎里没有任何 atoms/molecules 字面量
  ctx.config.roles = [
    { id: 'atoms', pattern: 'src/atoms/**', layer: 1 },
    { id: 'molecules', pattern: 'src/molecules/**', layer: 2 },
    { id: 'organisms', pattern: 'src/organisms/**', layer: 3 },
  ]
  const record = (rel, role, layer) => ({
    rel,
    abs: `/tmp/${rel}`,
    role,
    layer,
    domain: null,
    slot: null,
    captures: {},
    group: null,
    groupName: null,
    kind: 'ts',
  })
  ctx.records = [
    record('src/atoms/button.tsx', 'atoms', 1),
    record('src/molecules/card.tsx', 'molecules', 2),
    record('src/organisms/panel.tsx', 'organisms', 3),
  ]
  // atoms 引 molecules = 向上 → 报；organisms 引 atoms = 向下 → 不报
  ctx.graph = layeredGraph([
    ['src/atoms/button.tsx', ['src/molecules/card.tsx']],
    ['src/organisms/panel.tsx', ['src/atoms/button.tsx']],
  ])
  const found = rule.run(ctx)
  assert.equal(found.length, 1, '只报原子层引用分子层那一条')
  assert.equal(found[0].file, 'src/atoms/button.tsx')
})

test('S22 / S23：没声明就不跑（声明了才判，避免与外部工具重复报）', () => {
  const ctx = makeContext({ scan: {} })
  assert.equal(coreRules.find((item) => item.id === 'S22').run(ctx).length, 0)
  assert.equal(coreRules.find((item) => item.id === 'S23').run(ctx).length, 0)
})

test('S01 / S03：提示要指路（闭集枚举只说"你错了"没用，要说"放哪"）', () => {
  const s01 = coreRules.find((rule) => rule.id === 'S01')
  const s03 = coreRules.find((rule) => rule.id === 'S03')
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
  const findings = coreRules.find((rule) => rule.id === 'D08')?.run(ctx) ?? []
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
  const findings = coreRules.find((rule) => rule.id === 'D07')?.run(ctx) ?? []
  assert.deepEqual(findings, [], '解析不了的配色要跳过，而不是报一个假对比度')
})
