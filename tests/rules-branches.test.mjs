import assert from 'node:assert/strict'
import { test } from 'node:test'

import { extractFacts } from '../es/engine/facts.js'
import { collectI18n } from '../es/engine/i18n.js'
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
    scan: { records: [], files: [], missing: [], ambiguous: [], exempted: [] },
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

test('C 域：t() 的键与 `*Key` 属性都算引用，C01 只对真正用了 t() 的文件报裸文案', () => {
  const files = {
    'src/shared/i18n/locales/en/nav.ts':
      "export default {\n  crews: 'Crews',\n  dead: 'Dead',\n}\n",
    'src/shared/i18n/locales/zh-CN/nav.ts':
      "export default {\n  crews: '员工',\n  dead: '死键',\n}\n",
    // 用了 t()：裸文案要报；labelKey 也要被算成「键被使用」
    'src/modules/demo/views/A.tsx':
      "export function A({ t }: { t: (key: string) => string }) {\n  return <div>{t('nav.crews')}<span>写死的文案</span></div>\n}\n",
    'src/shared/config/nav.ts': "export const nav = [{ labelKey: 'nav.dead' }]\n",
    // 完全没用 t()：裸文案不报（它还没走 i18n，是另一个决定）
    'src/modules/demo/views/B.tsx':
      'export function B() {\n  return <div>另一个写死的文案</div>\n}\n',
  }
  const i18n = collectI18n({
    records: Object.keys(files).map((rel) => ({ rel, kind: 'ts' })),
    sourceOf: (rel) => files[rel],
    resourceDir: 'src/shared/i18n/locales',
  })
  const ctx = makeContext({ files, params: { resourceDir: 'src/shared/i18n/locales' }, i18n })
  const ids = (text) => text.map((finding) => `${finding.rule} ${finding.file}`)

  const c01 = reactRules.find((rule) => rule.id === 'C01')?.run(ctx) ?? []
  assert.deepEqual(ids(c01), ['C01 src/modules/demo/views/A.tsx'], 'B.tsx 没用 t()，不该报')

  const c02 = reactRules.find((rule) => rule.id === 'C02')?.run(ctx) ?? []
  assert.deepEqual(c02, [], 't() 与 labelKey 的键都存在')

  const c06 = reactRules.find((rule) => rule.id === 'C06')?.run(ctx) ?? []
  assert.deepEqual(
    c06.map((finding) => finding.text),
    [],
    'nav.dead 通过 labelKey 被使用，不该算死键',
  )
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

test('H 域：带引号/转义/嵌套括号的调用与词边界假数据都能处理', () => {
  const files = {
    'src/shared/lib/timers.ts': [
      // 字符串里的逗号与引号不该被当成参数分隔符
      "export const a = () => { setTimeout(() => { const s = 'a,b'; return s }, 300) }",
      // 转义引号 + 嵌套调用
      "export const c = () => { setTimeout(() => console.log('it\\'s'), 200) }",
      'export const d = () => Math.random()',
    ].join('\n'),
    // 字符串延时不是「固定等待」，不该被报
    'src/shared/lib/quoted.ts': 'export const b = () => { setTimeout(() => 1, "300") }',
    'src/shared/lib/fixtures.ts': [
      'export const mockUser = () => ({ id: 1 })',
      'export const notamock = 1',
      "export const label = 'dummy-user'",
      'export const real = 2',
    ].join('\n'),
  }
  const ctx = makeContext({ files })
  const h07 = reactRules.find((rule) => rule.id === 'H07')?.run(ctx) ?? []
  assert.ok(
    h07.some((finding) => finding.file === 'src/shared/lib/timers.ts'),
    '数字延迟要报',
  )
  assert.equal(
    h07.some((finding) => finding.file === 'src/shared/lib/quoted.ts'),
    false,
    '字符串延迟不是固定等待，不该报',
  )
  assert.ok(
    h07.some((finding) => /Math\.random/.test(finding.text)),
    'Math.random 要报',
  )

  const h09 = reactRules.find((rule) => rule.id === 'H09')?.run(ctx) ?? []
  // H09 按 spec 抓的是**字面量**（dummy/mock/fake/lorem），不是标识符名
  assert.ok(
    h09.some((finding) => /dummy-user/.test(finding.text)),
    '假数据字面量要报',
  )
  assert.equal(
    h09.some((finding) => /notamock/.test(finding.text)),
    false,
    'notamock 是词边界内的普通名',
  )
})
