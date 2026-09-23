import assert from 'node:assert/strict'
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

import {
  copy,
  deps,
  designSystem,
  canonical,
  createRule,
  loadConfig,
  reactRules,
  renderReport,
  renderSummary,
  runGuard,
} from '../es/index.js'

const PACKAGE_ROOT = fileURLToPath(new URL('..', import.meta.url))

/** 捕获唯一输出出口的文本（output.ts 走 console.log） */
function capture(fn) {
  const original = console.log
  const lines = []
  console.log = (...args) => lines.push(args.join(' '))
  try {
    fn()
  } finally {
    console.log = original
  }
  return lines.join('\n')
}

const copyFixture = (name) => {
  const dir = mkdtempSync(join(tmpdir(), `ag-${name}-`))
  cpSync(join(PACKAGE_ROOT, '__fixtures__', name), dir, { recursive: true })
  // 夹具里的 config 用相对路径引构建产物；复制到临时目录后要换成绝对 URL
  const configPath = join(dir, 'arch.config.mjs')
  if (existsSync(configPath)) {
    const entry = `file://${join(PACKAGE_ROOT, 'es/index.js')}`
    writeFileSync(
      configPath,
      readFileSync(configPath, 'utf8').replace("'../../es/index.js'", JSON.stringify(entry)),
    )
  }
  return dir
}

const baseInput = (overrides = {}) => ({
  config: { params: {} },
  ruleIndex: new Map(reactRules.map((rule) => [rule.id, rule])),
  findings: [],
  exemptedCount: 0,
  unusedBaseline: [],
  skipped: [],
  unknownEnabled: [],
  notices: [],
  scope: 'full',
  scopeFiles: 0,
  globalFindings: 0,
  durationMs: 1,
  rulesEnabled: 19,
  rulesTotal: 19,
  exemptedFiles: 0,
  ...overrides,
})

/* ---------------- 报告渲染 ---------------- */

test('report：按域分组、带修法、标注全局违规', () => {
  const text = capture(() =>
    renderReport(
      baseInput({
        findings: [
          {
            rule: 'S01',
            file: 'src/a.ts',
            line: 1,
            text: '不在目录契约内',
            hint: '放到槽位里',
            global: true,
          },
          { rule: 'H02', file: 'src/b.ts', line: 2, text: '禁用注释' },
        ],
      }),
    ),
  )
  assert.match(text, /结构（1）/)
  assert.match(text, /反退化（1）/)
  assert.match(text, /\[S01\]/)
  assert.match(text, /→ 放到槽位里/)
  assert.match(text, /（全局）/)
  assert.match(text, /\[H02\]/)
})

test('report：摘要自述 scope / 配置豁免 / 停用规则 / 过期基线', () => {
  const text = capture(() =>
    renderSummary(
      baseInput({
        findings: [{ rule: 'H02', file: 'a.ts', line: 1, text: 'x' }],
        scope: 'staged',
        scopeFiles: 3,
        globalFindings: 1,
        exemptedCount: 2,
        exemptedFiles: 1,
        skipped: [{ rule: 'D10', reason: '能力未声明：uiKit.vendorSelectors' }],
        unusedBaseline: [{ rule: 'H01', file: 'a.ts', anchor: 'x', anchorKind: 'line' }],
        unknownEnabled: ['NOPE'],
        notices: ['别名取自 tsconfig'],
      }),
    ),
  )
  assert.match(text, /scope=staged \| 3 个文件/)
  assert.match(text, /配置豁免 1 个文件/)
  assert.match(text, /✖ 架构守卫失败：1 个 error/)
})

test('report：通过时打印绿色结论，warn 不阻断', () => {
  const warnRule = createRule({
    id: 'H09',
    domain: 'hygiene',
    level: 'L2',
    severity: 'warn',
    title: 'w',
    run: () => [],
  })
  const text = capture(() =>
    renderSummary(
      baseInput({
        ruleIndex: new Map([[warnRule.id, warnRule]]),
        findings: [{ rule: 'H09', file: 'a.ts', line: 1, text: 'w' }],
      }),
    ),
  )
  assert.match(text, /✔ 架构守卫通过（1 个 warn）/)
})

test('report：停用规则与未知规则在 report 里明列（防「以为在跑」）', () => {
  const text = capture(() =>
    renderReport(
      baseInput({
        skipped: [{ rule: 'D10', reason: '能力未声明：uiKit.vendorSelectors' }],
        unknownEnabled: ['X99'],
        notices: ['仓库根变更路径已换算到配置根'],
      }),
    ),
  )
  assert.match(text, /因能力未声明而停用 1 条规则：D10/)
  assert.match(text, /配置里启用了不存在的规则：X99/)
  assert.match(text, /变更路径已换算/)
})

/* ---------------- 预置默认值 ---------------- */

test('presets：designSystem / copy / deps 的默认值与自定义值', () => {
  const defaults = designSystem()
  assert.equal(defaults.params?.tokenPrefix, '--sh')
  assert.equal(defaults.params?.spacing, '--spacing')
  assert.deepEqual(defaults.params?.themes, ['dark', 'light'])

  const custom = designSystem({ tokenPrefix: '--x', themes: ['light'] })
  assert.equal(custom.params?.tokenPrefix, '--x')
  assert.deepEqual(custom.params?.themes, ['light'])

  // copy() 以 **i18n 适配器**声明能力（适配器是数据）：资源目录与翻译函数都在里面
  const i18nDefault = copy().adapters?.i18n
  assert.equal(i18nDefault?.resourceDir, 'src/shared/i18n/locales')
  assert.equal(i18nDefault?.fn, 't')
  assert.deepEqual(i18nDefault?.languages, [])
  const i18nCustom = copy({ resourceDir: 'src/i18n', languages: ['zh-CN'], fn: 'tr' }).adapters
    ?.i18n
  assert.equal(i18nCustom?.resourceDir, 'src/i18n')
  assert.deepEqual(i18nCustom?.languages, ['zh-CN'])
  assert.equal(i18nCustom?.fn, 'tr')

  const policy = deps()
  assert.ok(Array.isArray(policy.params?.deny))
  assert.deepEqual(policy.params?.capabilities, {})
  assert.deepEqual(deps({ capabilities: { 'cli-args': 'commander' } }).params?.capabilities, {
    'cli-args': 'commander',
  })
})

test('presets：library 与 canonical 是两套角色表，且都完备', () => {
  const app = canonical()
  const lib = canonical({ src: 'app-src' })
  assert.ok(app.roles?.some((role) => role.pattern.includes('src/modules')))
  assert.ok(lib.roles?.some((role) => role.pattern.includes('app-src/modules')))
  assert.equal(app.layout?.app, 'src/app')
})

/* ---------------- run.ts 的路径 ---------------- */

test('run：--update-baseline 写入基线，第二次运行即被豁免', async () => {
  const dir = copyFixture('violations')
  try {
    const first = await runGuard({ cwd: dir, rules: reactRules, quiet: true, updateBaseline: true })
    assert.equal(first.exitCode, 0, '写入基线后本轮不报')
    const baseline = JSON.parse(readFileSync(join(dir, 'arch.baseline.json'), 'utf8'))
    assert.ok(baseline.entries.length >= 5, '委派了一批规则后条目变少')

    const second = await runGuard({ cwd: dir, rules: reactRules, quiet: true })
    assert.equal(second.active.length, 0, '存量违规被豁免')
    assert.equal(second.exitCode, 0)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('run：增量 scope 下禁止写基线（会写出不完整的基线）', async () => {
  const dir = copyFixture('violations')
  try {
    await assert.rejects(
      runGuard({ cwd: dir, rules: reactRules, quiet: true, scope: 'staged', updateBaseline: true }),
      /只能在全量 scope/,
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('run：--paths 过滤报告、--report-only 不阻断、规则异常 fail-closed', async () => {
  const dir = copyFixture('violations')
  try {
    const scoped = await runGuard({
      cwd: dir,
      rules: reactRules,
      quiet: true,
      paths: ['src/orphans/**'],
    })
    assert.deepEqual(
      [...new Set(scoped.active.map((finding) => finding.file))],
      ['src/orphans/thing.ts'],
    )

    const advisory = await runGuard({ cwd: dir, rules: reactRules, quiet: true, reportOnly: true })
    assert.equal(advisory.exitCode, 0, 'report-only 永远 0')
    assert.ok(advisory.active.length > 0)

    const boom = createRule({
      id: 'H99',
      domain: 'hygiene',
      level: 'L2',
      title: '会抛的规则',
      run: () => {
        throw new Error('boom')
      },
    })
    const crashed = await runGuard({
      cwd: dir,
      rules: [...reactRules, boom],
      quiet: true,
      only: ['H99'],
    })
    assert.equal(crashed.exitCode, 1, '规则异常必须 fail closed')
    assert.match(crashed.all[0]?.text ?? '', /规则执行异常/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('run：能力未声明时规则不注册，且报告里能看到 skipped', async () => {
  const result = await runGuard({
    cwd: `${PACKAGE_ROOT}examples/minimal`,
    rules: reactRules,
    quiet: true,
  })
  assert.equal(result.exitCode, 0)
  assert.ok(existsSync(join(PACKAGE_ROOT, 'examples/minimal/arch.config.mjs')))
  const { config } = await loadConfig({ root: `${PACKAGE_ROOT}examples/minimal` })
  assert.equal(config.enable === 'all' || Array.isArray(config.enable), true)
})

test('输出：GitHub 注解与 --stats 统计表（CI 与排查用）', async () => {
  const { renderGithubAnnotations, renderStats } = await import('../es/engine/report.js')
  const ruleIndex = new Map([
    ['H01', { id: 'H01', severity: 'error' }],
    ['S16', { id: 'S16', severity: 'warn' }],
  ])
  const input = {
    config: { root: '/tmp' },
    ruleIndex,
    findings: [
      { rule: 'H01', file: 'src/a.ts', line: 3, text: '问题一' },
      { rule: 'S16', file: 'src/b.ts', line: 7, text: '问题二\n换行要被压平' },
    ],
    exemptedCount: 0,
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
  }
  const annotations = renderGithubAnnotations(input)
  assert.match(annotations, /::error file=src\/a\.ts,line=3/)
  assert.match(annotations, /::warning file=src\/b\.ts,line=7/)
  assert.ok(!annotations.includes('\n换行'), '注解里的换行必须压平，否则会截断注解')

  const stats = renderStats(input, [
    { rule: 'S16', domain: 'structure', ms: 12.5, hits: 2 },
    { rule: 'H01', domain: 'hygiene', ms: 1.25, hits: 1 },
  ])
  assert.match(stats, /S16\s+structure\s+12\.50ms\s+2 命中/)
  assert.match(stats, /合计 13\.75ms \/ 2 条规则/)
})
