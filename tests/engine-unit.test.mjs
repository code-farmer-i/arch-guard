import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  AdapterError,
  RuleDefinitionError,
  anchorOf,
  antdKit,
  applyBaseline,
  createRule,
  defineAdapter,
  entriesFromFindings,
  globToRegExp,
  loadBaseline,
  mergePresets,
  saveBaseline,
  summarize,
  toJsonReport,
} from '../es/index.js'

/* ---------------- 工具层 ---------------- */

test('glob：支持 ** / ? / 花括号枚举 / 转义', () => {
  assert.ok(globToRegExp('src/**/a.ts').test('src/a.ts'))
  assert.ok(globToRegExp('src/**/a.ts').test('src/x/y/a.ts'))
  assert.ok(globToRegExp('a.{ts,tsx}').test('a.tsx'))
  assert.ok(!globToRegExp('a.{ts,tsx}').test('a.js'))
  assert.ok(globToRegExp('a?.ts').test('ab.ts'))
  assert.ok(!globToRegExp('a?.ts').test('a/b.ts'))
  assert.ok(globToRegExp('a.b.ts').test('a.b.ts'), '点号必须转义（不当通配）')
  // 花括号里的字面量枚举也要转义：`{index.ts}` 的 `.` 不该变成"任意字符"
  assert.ok(globToRegExp('src/{index.ts,cli.ts}').test('src/index.ts'))
  assert.ok(!globToRegExp('src/{index.ts,cli.ts}').test('src/indexXts'), '花括号内的点号必须转义')
  assert.ok(!globToRegExp('src/{index.ts,cli.ts}').test('src/index.ts.bak'))
})

test('锚点：对格式不敏感，对内容敏感', () => {
  assert.equal(anchorOf('  const a = 1  '), anchorOf('const   a =  1'))
  assert.notEqual(anchorOf('const a = 1'), anchorOf('const a = 2'))
  assert.equal(anchorOf(undefined), anchorOf(''))
})

test('mergePresets：数组拼接、对象合并、enable 后者覆盖', () => {
  const merged = mergePresets([
    { ignore: ['a'], layout: { app: 'src/app', modules: 'm', shared: 's' }, enable: ['S01'] },
    { ignore: ['b'], layout: { app: 'x/app' }, enable: ['S02'] },
  ])
  assert.deepEqual(merged.ignore, ['a', 'b'])
  assert.deepEqual(merged.enable, ['S02'])
  assert.equal(merged.layout?.app, 'x/app')
  assert.equal(merged.layout?.modules, 'm')
})

/* ---------------- 棘轮 ---------------- */

test('baseline：缺失文件当空基线；损坏文件报错而不是静默', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ag-baseline-'))
  assert.deepEqual(loadBaseline(join(dir, 'none.json')).entries, [])
  writeFileSync(join(dir, 'broken.json'), '{ not json')
  assert.throws(() => loadBaseline(join(dir, 'broken.json')), /无法解析/)
})

test('baseline：写读往返 + 文件级锚点 + 去重', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ag-rt-'))
  const file = join(dir, 'arch.baseline.json')
  const findings = [
    { rule: 'H03', file: 'a.ts', line: 1, text: 'x', anchorKind: 'file' },
    { rule: 'H03', file: 'a.ts', line: 1, text: 'x', anchorKind: 'file' },
  ]
  const entries = entriesFromFindings(findings, () => undefined)
  assert.equal(entries.length, 1, '同规则同文件同锚点去重')
  assert.equal(entries[0]?.anchorKind, 'file')
  saveBaseline(file, entries)
  assert.deepEqual(loadBaseline(file).entries, entries)
  assert.match(readFileSync(file, 'utf8'), /"version": 1/)
})

test('baseline：未命中的条目算过期（不再需要）', () => {
  const split = applyBaseline(
    [],
    { version: 1, entries: [{ rule: 'X', file: 'a.ts', anchor: 'abc', anchorKind: 'line' }] },
    () => '',
  )
  assert.equal(split.unused.length, 1)
  assert.equal(split.active.length, 0)
})

/* ---------------- 适配器与规则契约 ---------------- */

test('adapters：每一类非法声明都报错', () => {
  assert.throws(() => defineAdapter('nope', { id: 'x' }), AdapterError)
  assert.throws(() => defineAdapter('ui-kit', {}), /缺少 id/)
  assert.throws(() => defineAdapter('ui-kit', { id: 'x', packages: 'antd' }), /必须是字符串数组/)
  assert.throws(() => defineAdapter('ui-kit', { id: 'x', vendorSelectors: ['('] }), /正则无法编译/)
  assert.throws(() => defineAdapter('ui-kit', { id: 'x', styleProps: [1] }), /必须是字符串数组/)
  assert.throws(
    () => defineAdapter('ui-kit', { id: 'x', detachedApis: [{ from: 'antd' }] }),
    /from\[\] 与 members\[\]/,
  )
  assert.throws(
    () => defineAdapter('ui-kit', { id: 'x', examples: { vendorSelectors: { hit: ['.x'] } } }),
    /同时给出 hit 与 miss/,
  )
})

test('presets：antd 适配器声明合法且样例自洽', () => {
  const adapter = antdKit()
  assert.equal(adapter.facet, 'ui-kit')
  assert.ok(adapter.vendorSelectors?.length)
  assert.ok(adapter.detachedApis?.some((api) => api.members.includes('message')))
  assert.ok(Object.isFrozen(adapter))
})

test('rule：缺 title / 缺 run / id 前缀错都报错', () => {
  assert.throws(
    () => createRule({ id: 'H01', domain: 'hygiene', level: 'L2', title: '', run: () => [] }),
    RuleDefinitionError,
  )
  assert.throws(
    () => createRule({ id: 'H01', domain: 'hygiene', level: 'L2', title: 'x', run: undefined }),
    RuleDefinitionError,
  )
  assert.throws(
    () => createRule({ id: 'Z01', domain: 'hygiene', level: 'L2', title: 'x', run: () => [] }),
    RuleDefinitionError,
  )
})

/* ---------------- 报告 ---------------- */

test('report：严重度统计与 JSON 形状', () => {
  const warnRule = createRule({
    id: 'H09',
    domain: 'hygiene',
    level: 'L2',
    severity: 'warn',
    title: 'w',
    run: () => [],
  })
  const errRule = createRule({
    id: 'H08',
    domain: 'hygiene',
    level: 'L2',
    title: 'e',
    run: () => [],
  })
  const index = new Map([
    [warnRule.id, warnRule],
    [errRule.id, errRule],
  ])
  const findings = [
    { rule: 'H09', file: 'a.ts', line: 1, text: 'w' },
    { rule: 'H08', file: 'a.ts', line: 2, text: 'e' },
  ]
  assert.deepEqual(summarize(findings, index), { errors: 1, warnings: 1 })
  const report = toJsonReport({
    config: { params: {} },
    ruleIndex: index,
    findings,
    exemptedCount: 2,
    unusedBaseline: [],
    skipped: [],
    unknownEnabled: [],
    notices: [],
    scope: 'full',
    scopeFiles: 0,
    globalFindings: 0,
    durationMs: 1,
    rulesEnabled: 2,
    rulesTotal: 2,
    exemptedFiles: 0,
    contractScope: [],
    outsideContract: 0,
  })
  assert.equal(report.ok, false)
  assert.equal(report.errors, 1)
  assert.equal(report.findings[0]?.severity, 'warn')
  assert.equal(report.findings[0]?.domain, 'hygiene')
})
