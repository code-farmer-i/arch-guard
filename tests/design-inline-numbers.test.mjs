import assert from 'node:assert/strict'
import { test } from 'node:test'

import { coreRules } from '../es/index.js'

/**
 * D15 内联样式纪律 · D19 同一数值跨文件重复 · D20 策略 / 阈值数字必须有家。
 *
 * 三条的骨架用**合成 facts** 测（准、快），端到端那条路由夹具 `inline-style` /
 * `repeated-values` / `number-homes` 与 `--self-test` 保证（可搬运性靠事实模型）。
 */

const rule = (id) => {
  const found = coreRules.find((entry) => entry.id === id)
  assert.ok(found, `规则 ${id} 不存在`)
  return found
}

const context = ({ cfg = {}, records = [], facts = {}, files = [], sources = {} } = {}) => ({
  config: {
    root: '/tmp/design-fixtures',
    srcRoot: 'src',
    adapters: {},
    params: {},
    layout: { app: 'src/app', modules: 'src/modules', shared: 'src/shared' },
    roles: [],
    thresholds: {},
    naming: {},
    entries: [],
    ignore: [],
    aliases: {},
    ...cfg,
  },
  records,
  facts: new Map(Object.entries(facts)),
  graph: { edges: new Map(), importers: new Map(), orphaned: [], reachable: new Set() },
  scan: {
    records: [],
    files: [],
    missing: [],
    ambiguous: [],
    exempted: [],
    outside: [],
    foreign: [],
  },
  files,
  sourceOf: (rel) => sources[rel],
})

const WHITELISTS = [
  { rule: 'D12', allow: ['8px', '16px'] },
  { rule: 'D13', allow: ['1', '10'] },
  { rule: 'D14', allow: ['150ms'] },
]

/* ---------------- D15 ---------------- */

test('D15：颜色字面量、超刻度数值都报；var() / 白名单 / lineHeight / 0 不报', () => {
  const file = 'src/modules/crews/views/CrewsPage.tsx'
  const findings = rule('D15').run(
    context({
      cfg: { params: { valueWhitelists: WHITELISTS } },
      records: [{ rel: file }],
      facts: {
        [file]: {
          styleProps: [
            { prop: 'color', value: '#ff5a1f', numeric: false, line: 3 },
            { prop: 'backgroundColor', value: 'var(--brand)', numeric: false, line: 4 },
            { prop: 'margin', value: '13', numeric: true, line: 5 },
            { prop: 'fontSize', value: '13px', numeric: false, line: 6 },
            { prop: 'marginTop', value: '8px', numeric: false, line: 7 },
            { prop: 'padding', value: '0', numeric: true, line: 8 },
            { prop: 'lineHeight', value: '1.5', numeric: true, line: 9 },
            { prop: 'zIndex', value: '9999', numeric: true, line: 10 },
            { prop: 'zIndex', value: '10', numeric: true, line: 11 },
            { prop: 'transitionDuration', value: '200ms', numeric: false, line: 12 },
            { prop: 'display', value: 'flex', numeric: false, line: 13 },
          ],
        },
      },
    }),
  )
  assert.deepEqual(
    findings.map((item) => [item.line, item.rule]),
    [
      [3, 'D15'],
      [5, 'D15'],
      [6, 'D15'],
      [10, 'D15'],
      [12, 'D15'],
    ],
  )
  assert.match(findings[0].text, /写死颜色：color: #ff5a1f/)
  assert.match(findings[1].text, /margin: 13px 不在长度的刻度里/)
  assert.match(findings[2].text, /font-size: 13px 不在长度的刻度里/)
  assert.match(findings[3].text, /z-index: 9999 不在层级的刻度里/)
  assert.match(findings[4].text, /transition-duration: 200ms 不在时长的刻度里/)
})

test('D15：那一族没声明刻度就不判（声明才判）', () => {
  const file = 'src/App.tsx'
  const findings = rule('D15').run(
    context({
      cfg: { params: { valueWhitelists: [{ rule: 'D13', allow: ['1'] }] } },
      records: [{ rel: file }],
      facts: {
        [file]: {
          styleProps: [
            { prop: 'margin', value: '13', numeric: true, line: 2 },
            { prop: 'zIndex', value: '9999', numeric: true, line: 3 },
          ],
        },
      },
    }),
  )
  assert.deepEqual(
    findings.map((item) => item.rule),
    ['D15'],
  )
  assert.match(findings[0].text, /z-index/)
})

test('D15：没有 styleProps 的文件（非 JSX / 动态值）一条都不报', () => {
  assert.deepEqual(
    rule('D15').run(
      context({
        cfg: { params: { valueWhitelists: WHITELISTS } },
        records: [{ rel: 'src/shared/lib/format.ts' }],
        facts: { 'src/shared/lib/format.ts': {} },
      }),
    ),
    [],
  )
})

/* ---------------- D19 ---------------- */

const cssContext = (files, params = {}) =>
  context({
    cfg: { params },
    records: files.map(([rel]) => ({ rel, kind: 'css' })),
    files: files.map(([rel]) => rel),
    sources: Object.fromEntries(files),
  })

const css = (body) => `.card {\n${body}\n}\n`

test('D19：同一 (属性, 数值) 跨 ≥3 个非令牌文件才提示（2 个不够）', () => {
  const three = {
    'src/a/Card.module.css': css('  padding: 13px;'),
    'src/b/Card.module.css': css('  padding: 13px;'),
    'src/c/Card.module.css': css('  padding: 13px;'),
  }
  const findings = rule('D19').run(cssContext(Object.entries(three)))
  assert.equal(findings.length, 1)
  assert.equal(findings[0].rule, 'D19')
  assert.equal(findings[0].file, 'src/a/Card.module.css')
  assert.match(findings[0].text, /在 3 个文件里重复出现/)

  const two = {
    'src/a/Card.module.css': css('  padding: 13px;'),
    'src/b/Card.module.css': css('  padding: 13px;'),
  }
  assert.deepEqual(rule('D19').run(cssContext(Object.entries(two))), [])
})

test('D19：枚举值 / 颜色 / 0 / 已声明刻度 / 令牌文件都不提示', () => {
  const files = {
    'src/a/Card.module.css': css(
      '  display: flex;\n  color: #ff5a1f;\n  padding: 0;\n  margin: 8px;',
    ),
    'src/b/Card.module.css': css(
      '  display: flex;\n  color: #ff5a1f;\n  padding: 0;\n  margin: 8px;',
    ),
    'src/c/Card.module.css': css(
      '  display: flex;\n  color: #ff5a1f;\n  padding: 0;\n  margin: 8px;',
    ),
    'src/shared/styles/tokens/scales.css': css('  padding: 13px;\n  padding: 13px;'),
    'src/d/Card.module.css': css('  padding: 13px;'),
    'src/e/Card.module.css': css('  padding: 13px;'),
  }
  const findings = rule('D19').run(
    cssContext(Object.entries(files), {
      tokenDir: 'src/shared/styles/tokens',
      valueWhitelists: [{ rule: 'D12', allow: ['8px'] }],
    }),
  )
  // 只有 d / e 两个文件重复（a/b/c 是枚举值/颜色/0，令牌文件被跳过）→ 不到 3 个 → 不报
  assert.deepEqual(findings, [])
})

test('D19：是 warn（"该有名字"是提示，不是违规）', () => {
  assert.equal(rule('D19').severity, 'warn')
  assert.equal(rule('D19').level, 'L3')
})

/* ---------------- D20 ---------------- */

const HOMES = [{ name: '请求策略', names: ['staleTime', 'retry'], in: ['src/shared/config/**'] }]

test('D20：名单里的名字写在声明的家之外就报；家里 / 名单外 / 无名数字不报', () => {
  const browser = 'src/modules/crews/hooks/useCrews.ts'
  const home = 'src/shared/config/query.ts'
  const findings = rule('D20').run(
    context({
      cfg: { params: { numberHomes: HOMES } },
      records: [{ rel: browser }, { rel: home }],
      facts: {
        [browser]: {
          numbers: [
            { value: 300000, raw: '300_000', name: 'staleTime', line: 1 },
            { value: 3, raw: '3', name: 'retry', line: 1 },
            { value: 5000, raw: '5_000', name: 'timeout', line: 4 },
            { value: 2, raw: '2', name: null, line: 9 },
          ],
        },
        [home]: { numbers: [{ value: 300000, raw: '300_000', name: 'staleTime', line: 1 }] },
      },
    }),
  )
  assert.deepEqual(
    findings.map((item) => [item.file, item.line]),
    [
      [browser, 1],
      [browser, 1],
    ],
  )
  assert.match(findings[0].text, /请求策略的数字该写在 src\/shared\/config\/\*\*/)
})

test('D20：不声明 numberHomes 就不判', () => {
  assert.deepEqual(
    rule('D20').run(
      context({
        records: [{ rel: 'src/a.ts' }],
        facts: { 'src/a.ts': { numbers: [{ value: 1, raw: '1', name: 'staleTime', line: 1 }] } },
      }),
    ),
    [],
  )
})
