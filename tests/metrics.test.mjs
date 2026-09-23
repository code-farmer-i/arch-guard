import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { aggregate, readCoverageReport } from '../es/engine/coverage.js'
import { reactRules } from '../es/packs/react/index.js'

const ruleOf = (id) => {
  const rule = reactRules.find((item) => item.id === id)
  assert.ok(rule, `${id} 不存在`)
  return rule
}

/** 只填被测规则会读的字段 */
function context({ coverage, report, error, changedFiles = null, headTimeMs = null, deps } = {}) {
  return {
    config: {
      root: '/tmp/metrics',
      params: {},
      adapters: coverage ? { metrics: { facet: 'metrics', id: 'coverage', coverage } } : {},
    },
    ...(report !== undefined || error !== undefined
      ? {
          metrics: {
            reportPath: 'coverage-summary.json',
            report: report ?? null,
            ...(error ? { error } : {}),
          },
        }
      : {}),
    git: { changedFiles, headTimeMs },
    ...(deps ? { deps } : {}),
  }
}

test('coverage：istanbul 摘要的绝对路径会换算成配置根相对路径', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ag-cov-'))
  try {
    const metric = (lines, branches, functions) => ({
      lines: { pct: lines },
      branches: { pct: branches },
      functions: { pct: functions },
      statements: { pct: lines },
    })
    writeFileSync(
      join(dir, 'coverage-summary.json'),
      JSON.stringify({
        total: metric(50, 50, 50),
        [`${dir}/src/a.ts`]: metric(100, 90, 80),
        '/outside/b.ts': metric(0, 0, 0),
      }),
    )
    const report = readCoverageReport(join(dir, 'coverage-summary.json'), dir)
    assert.equal(report.format, 'istanbul-json')
    assert.deepEqual(report.files.map((file) => file.rel).sort(), ['/outside/b.ts', 'src/a.ts'])
    assert.deepEqual(
      aggregate(report, (rel) => rel === 'src/a.ts'),
      {
        files: 1,
        lines: 100,
        branches: 90,
        functions: 80,
      },
    )
    assert.equal(
      aggregate(report, (rel) => rel.startsWith('src/none')),
      null,
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('coverage：Node 覆盖率表格（带缩进的树）也能还原路径', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ag-cov2-'))
  try {
    writeFileSync(
      join(dir, 'coverage.txt'),
      [
        'file | line % | branch % | funcs % | uncovered lines',
        '-----|--------|----------|---------|----------------',
        'src |  |  |  | ',
        ' engine |  |  |  | ',
        '  report.js | 90.00 | 80.00 | 70.00 | 12-15',
        '  run.js | 95.00 | 85.00 | 99.00 | ',
        ' all files | 92.00 | 82.00 | 88.00 | ',
      ].join('\n'),
    )
    const report = readCoverageReport(join(dir, 'coverage.txt'), dir)
    assert.equal(report.format, 'node-table')
    assert.deepEqual(
      report.files.map((file) => [file.rel, file.lines]),
      [
        ['src/engine/report.js', 90],
        ['src/engine/run.js', 95],
      ],
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('M06：产物读不到就 fail-closed（错误信息写清怎么修）', () => {
  const findings = ruleOf('M06').run(
    context({ coverage: { report: 'coverage-summary.json' }, error: 'ENOENT' }),
  )
  assert.equal(findings.length, 1)
  assert.match(findings[0]?.text ?? '', /覆盖率产物读不到：ENOENT/)
  assert.match(findings[0]?.hint ?? '', /先跑覆盖率/)

  // 没配报告 → 规则安静
  assert.deepEqual(ruleOf('M06').run(context({})), [])
})

test('M06：产物比最近一次提交还旧也要报', () => {
  const report = { path: '/tmp/x/c.json', format: 'istanbul-json', mtimeMs: 1000, files: [] }
  const findings = ruleOf('M06').run(
    context({ coverage: { report: 'c.json' }, report, headTimeMs: 5000 }),
  )
  assert.equal(findings.length, 1)
  assert.match(findings[0]?.text ?? '', /还旧/)
  assert.deepEqual(
    ruleOf('M06').run(context({ coverage: { report: 'c.json' }, report, headTimeMs: 500 })),
    [],
    '比提交新就不报',
  )
})

test('M05：改动的源文件没被覆盖就点名，非源文件不管', () => {
  const report = {
    path: '/tmp/x/c.json',
    format: 'istanbul-json',
    mtimeMs: 1,
    files: [
      { rel: 'src/shared/lib/bad.ts', lines: 40, branches: 0, functions: 0, statements: 40 },
      { rel: 'src/shared/lib/zero.ts', lines: 0, branches: 0, functions: 0, statements: 0 },
    ],
  }
  const findings = ruleOf('M05').run(
    context({
      coverage: { report: 'c.json', mustCover: ['src/**'] },
      report,
      changedFiles: ['src/shared/lib/bad.ts', 'src/shared/lib/zero.ts', 'docs/a.md'],
    }),
  )
  assert.deepEqual(
    findings.map((item) => item.file),
    ['src/shared/lib/zero.ts'],
    '覆盖率 >0 的改动文件不报；docs 不在 mustCover 里',
  )
})

test('M02：配置的目录一个文件都没匹配时明确报出来（防配置写错）', () => {
  const report = { path: '/tmp/x/c.json', format: 'istanbul-json', mtimeMs: 1, files: [] }
  const findings = ruleOf('M02').run(
    context({ coverage: { report: 'c.json', perDirMin: { 'src/engine/**': 90 } }, report }),
  )
  assert.equal(findings.length, 1)
  assert.match(findings[0]?.text ?? '', /没有文件匹配/)
})

test('M08：该有测试的文件要么被测试 import，要么有同名配对测试', () => {
  const source = (rel) => ({
    rel,
    abs: `/tmp/${rel}`,
    role: 'shared:lib',
    layer: 1,
    domain: null,
    slot: 'lib',
    kind: 'ts',
  })
  const context = {
    config: {
      root: '/tmp/metrics',
      params: {},
      adapters: {
        metrics: {
          facet: 'metrics',
          id: 'coverage',
          tests: { requireTestsFor: ['src/engine/**'] },
        },
      },
    },
    records: [
      source('src/engine/covered.ts'),
      source('src/engine/pair.ts'),
      source('src/engine/naked.ts'),
      source('src/engine/ignored.tsx'),
      source('tests/covered.test.ts'),
      source('tests/pair.test.ts'),
    ],
    graph: { importers: new Map([['src/engine/covered.ts', new Set(['tests/covered.test.ts'])]]) },
    // 测试文件从完整文件集里找（测试常在契约扫描域之外，没有角色、不进 records）
    files: [
      'src/engine/covered.ts',
      'src/engine/pair.ts',
      'src/engine/naked.ts',
      'src/engine/ignored.tsx',
      'tests/covered.test.ts',
      'tests/pair.test.ts',
    ],
  }
  const findings = ruleOf('M08').run(context)
  assert.deepEqual(
    findings.map((item) => item.file),
    ['src/engine/naked.ts', 'src/engine/ignored.tsx'],
    '被 import 的不报、同名配对的不报；requireTestsFor 之外的不管',
  )
})

test('M09：check 链路没跑测试/覆盖率就报出来', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ag-chain-'))
  try {
    const write = (scripts) =>
      writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'x', scripts }))
    const context = {
      config: {
        root: dir,
        params: {},
        adapters: {
          metrics: {
            facet: 'metrics',
            id: 'coverage',
            checkChain: { script: 'check', require: ['test', 'coverage'] },
          },
        },
      },
    }
    write({ check: 'node tools/check.mjs' })
    const missing = ruleOf('M09').run(context)
    assert.equal(missing.length, 1)
    assert.match(missing[0]?.text ?? '', /缺少：test \/ coverage/)

    write({ check: 'run-s build test coverage guard' })
    assert.deepEqual(ruleOf('M09').run(context), [], '链路齐全就不报')

    write({ build: 'tsc' })
    assert.match(ruleOf('M09').run(context)[0]?.text ?? '', /没有 check 脚本/)

    // 没配 checkChain → 规则安静
    assert.deepEqual(ruleOf('M09').run({ config: { root: dir, params: {}, adapters: {} } }), [])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
