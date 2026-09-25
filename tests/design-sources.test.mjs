import assert from 'node:assert/strict'
import { test } from 'node:test'

import { coreRules } from '../es/index.js'

/**
 * 「唯一出处」两条（D22 缓存键 / D23 路由路径）的分支：
 * 落点缺失 / 未声明 / 形态可配 / 引用与落点文件内的写法不报。
 */

const rule = (id) => {
  const found = coreRules.find((entry) => entry.id === id)
  assert.ok(found, `规则 ${id} 不存在`)
  return found
}

const config = (adapters = {}) => ({
  root: '/tmp/design-sources',
  srcRoot: 'src',
  paradigm: 'canonical',
  adapters,
  params: {},
  layout: { app: 'src/app', modules: 'src/modules', shared: 'src/shared' },
  roles: [],
  thresholds: {},
  naming: {},
  entries: [],
  ignore: [],
  aliases: {},
})

const context = ({ cfg, records = [], facts = {}, files = [], missing = [] }) => ({
  config: cfg,
  records,
  facts: new Map(Object.entries(facts)),
  graph: { edges: new Map(), importers: new Map(), orphaned: [], reachable: new Set() },
  scan: { records: [], files: [], missing, ambiguous: [], exempted: [], outside: [], foreign: [] },
  files,
  sourceOf: () => undefined,
})

const SOURCE = 'src/shared/config/paths.ts'
const KEYS = 'src/shared/api/queryKeys.ts'

test('D23：只认声明的落点；路径字面量（path / to）与跳转调用都算', () => {
  const cfg = config({ router: { facet: 'router', id: 'x', pathSource: SOURCE } })
  const findings = rule('D23').run(
    context({
      cfg,
      records: [{ rel: 'src/app/router/index.ts' }, { rel: SOURCE }],
      files: [SOURCE, 'src/app/router/index.ts'],
      facts: {
        'src/app/router/index.ts': {
          strings: [
            { value: '/crews', line: 3, prop: 'path' },
            { value: 'crews', line: 5, prop: 'id' },
          ],
          calls: [
            { callee: 'navigate', line: 7, stringArg: '/orders' },
            { callee: 'console.log', line: 9, stringArg: '/not-a-navigation' },
          ],
        },
        // 落点文件里的字面量就是"唯一出处"本身 → 不报
        [SOURCE]: { strings: [{ value: '/crews', line: 2, prop: 'crews' }], calls: [] },
      },
    }),
  )
  assert.deepEqual(
    findings.map((item) => item.line).sort((a, b) => a - b),
    [3, 7],
    '只报 path 字面量与 navigate 实参：不相关的调用、落点文件内的字面量都不报',
  )
})

test('D22：缓存键字面量按声明的属性名判；引用与落点文件内不报', () => {
  const cfg = config({ 'data-layer': { facet: 'data-layer', id: 'x', queryKeyFrom: KEYS } })
  const findings = rule('D22').run(
    context({
      cfg,
      records: [{ rel: 'src/modules/crews/hooks/useCrews.ts' }, { rel: KEYS }],
      files: [KEYS, 'src/modules/crews/hooks/useCrews.ts'],
      facts: {
        'src/modules/crews/hooks/useCrews.ts': {
          // 手拼键（数组里的字面量靠 prop 透传拿到 queryKey）
          strings: [
            { value: 'crews', line: 4, prop: 'queryKey' },
            { value: 'not-a-key', line: 6, prop: 'label' },
          ],
          calls: [],
        },
        [KEYS]: { strings: [{ value: 'crews', line: 2, prop: 'list' }], calls: [] },
      },
    }),
  )
  assert.deepEqual(
    findings.map((item) => item.line),
    [4],
  )
})

test('D22 / D23：形态可配（属性名与调用名都由方案面声明）', () => {
  const cfg = config({
    router: {
      facet: 'router',
      id: 'x',
      pathSource: SOURCE,
      pathProps: ['href'],
      navigateCalls: ['router.push'],
    },
  })
  const findings = rule('D23').run(
    context({
      cfg,
      records: [{ rel: 'src/app/router/index.ts' }, { rel: SOURCE }],
      files: [SOURCE, 'src/app/router/index.ts'],
      facts: {
        'src/app/router/index.ts': {
          strings: [
            { value: '/via-href', line: 2, prop: 'href' },
            { value: '/via-path', line: 3, prop: 'path' },
          ],
          calls: [
            { callee: 'router.push', line: 4, stringArg: '/pushed' },
            { callee: 'navigate', line: 5, stringArg: '/not-declared' },
          ],
        },
        [SOURCE]: { strings: [], calls: [] },
      },
    }),
  )
  assert.deepEqual(
    findings.map((item) => item.line).sort((a, b) => a - b),
    [2, 4],
    '声明了 href / router.push → 只认这两个；path 与 navigate 不再算',
  )
})

test('落点不存在：只报一条"落点不存在"，不逐条刷整个项目', () => {
  for (const [id, adapters, source] of [
    [
      'D22',
      { 'data-layer': { facet: 'data-layer', id: 'x', queryKeyFrom: 'src/nope.ts' } },
      'src/nope.ts',
    ],
    ['D23', { router: { facet: 'router', id: 'x', pathSource: 'src/nope.ts' } }, 'src/nope.ts'],
    [
      'D24',
      {
        analytics: {
          facet: 'analytics',
          id: 'x',
          apis: ['track'],
          eventSource: 'src/nope.ts',
        },
      },
      'src/nope.ts',
    ],
  ]) {
    const findings = rule(id).run(
      context({
        cfg: config(adapters),
        records: [{ rel: 'src/app/router/index.ts' }],
        files: ['src/app/router/index.ts'],
        facts: {
          'src/app/router/index.ts': {
            strings: [{ value: '/crews', line: 1, prop: 'path' }],
            // D24 会拿每一个 track() 调用去刷屏 —— 正是这条守卫要挡住的
            calls: [{ callee: 'track', line: 2, stringArg: 'crews_view' }],
          },
        },
      }),
    )
    assert.equal(findings.length, 1, `${id}：落点写错时不该逐条报`)
    assert.match(findings[0].text, new RegExp(`${source} 不存在`))
    assert.equal(findings[0].global, true, '这是全局发现项（不挂在某一行代码上）')
  }
})

test('没声明落点：直接调用也不报（真跑时本规则由 requires 明列停用）', () => {
  const facts = {
    'src/app/router/index.ts': { strings: [{ value: '/crews', line: 1, prop: 'path' }], calls: [] },
  }
  for (const id of ['D22', 'D23', 'D24']) {
    const findings = rule(id).run(
      context({
        cfg: config({}),
        records: [{ rel: 'src/app/router/index.ts' }],
        files: ['src/app/router/index.ts'],
        facts,
      }),
    )
    assert.deepEqual(findings, [])
  }
})

test('D24：事件名直接传字面量就报；方法后缀算同一族；常量与事件表本身不报', () => {
  const cfg = config({
    analytics: { facet: 'analytics', id: 'x', apis: ['track'], eventSource: SOURCE },
  })
  const findings = rule('D24').run(
    context({
      cfg,
      records: [{ rel: 'src/modules/crews/views/CrewsPage.tsx' }, { rel: SOURCE }],
      files: [SOURCE, 'src/modules/crews/views/CrewsPage.tsx'],
      facts: {
        'src/modules/crews/views/CrewsPage.tsx': {
          strings: [],
          calls: [
            { callee: 'track', line: 3, stringArg: 'crews_view' },
            { callee: 'analytics.track', line: 4, stringArg: 'crews_view' },
            { callee: 'track', line: 5 }, // 传常量 → 没有 stringArg
            { callee: 'console.log', line: 6, stringArg: 'crews_view' },
          ],
        },
        // 事件表本身放的就是这些字面量 → 不报
        [SOURCE]: { strings: [], calls: [{ callee: 'track', line: 1, stringArg: 'crews_view' }] },
      },
    }),
  )
  assert.deepEqual(
    findings.map((item) => item.line),
    [3, 4],
    '只有直接传字面量的两处报；常量调用、无关调用、事件表本身都不报',
  )
})
