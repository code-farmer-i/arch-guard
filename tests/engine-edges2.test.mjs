import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { loadBaseline, saveBaseline } from '../es/engine/baseline.js'
import { aliasesFromTsconfig } from '../es/engine/config.js'
import { parseLocaleFile } from '../es/engine/i18n.js'
import { renderReport } from '../es/engine/report.js'
import { describeTypeScriptProblem, installedVersion } from '../es/engine/ts-api.js'

/** 抓 stdout */
function capture(fn) {
  const lines = []
  const original = console.log
  console.log = (line = '') => lines.push(String(line))
  try {
    fn()
  } finally {
    console.log = original
  }
  return lines.join('\n')
}

test('report：基线里的失效豁免要单独提示（否则没人敢动基线）', () => {
  const text = capture(() =>
    renderReport({
      config: { root: '/tmp', baselineFile: 'arch.baseline.json' },
      ruleIndex: new Map(),
      findings: [],
      exemptedCount: 2,
      unusedBaseline: [{ rule: 'H03', file: 'src/a.ts', anchor: 'x' }],
      skipped: [],
      unknownEnabled: [],
      notices: [],
      scope: 'full',
      scopeFiles: 0,
      globalFindings: 0,
      durationMs: 1,
      rulesEnabled: 0,
      rulesTotal: 0,
      exemptedFiles: 0,
    }),
  )
  assert.match(text, /基线里有 1 条已失效的豁免/)
})

test('baseline：损坏的基线文件显式报错，不静默当空基线', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ag-bl-'))
  try {
    const path = join(dir, 'arch.baseline.json')
    writeFileSync(path, '{ 这不是 JSON')
    assert.throws(() => loadBaseline(path), /基线文件无法解析/)

    // 写读往返带 specVersion
    saveBaseline(path, [])
    const loaded = loadBaseline(path)
    assert.equal(loaded.specVersion, '1')

    // specVersion 不兼容时显式报错
    writeFileSync(path, JSON.stringify({ version: 1, specVersion: '9', entries: [] }))
    assert.throws(() => loadBaseline(path), /specVersion 不支持/)

    // 缺 version / entries 的旧基线：按空基线读，不崩
    writeFileSync(path, JSON.stringify({}))
    const legacy = loadBaseline(path)
    assert.equal(legacy.version, 1)
    assert.deepEqual(legacy.entries, [])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('aliases：baseUrl 非当前目录时也要拼对', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ag-bu-'))
  try {
    mkdirSync(join(dir, 'src'), { recursive: true })
    writeFileSync(
      join(dir, 'tsconfig.json'),
      JSON.stringify({ compilerOptions: { baseUrl: './src', paths: { '@app/*': ['app/*'] } } }),
    )
    const found = aliasesFromTsconfig(dir)
    assert.equal(found.aliases['@app'], 'src/app')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('i18n：计算属性名的键也能取到名字', () => {
  const parsed = parseLocaleFile(
    'src/shared/i18n/locales/en/nav.ts',
    "const key = 'x'\nexport default {\n  [key]: 'computed',\n  plain: 'ok',\n}\n",
    'src/shared/i18n/locales',
  )
  assert.deepEqual(
    parsed?.keys.map((item) => item.path),
    ['nav.key', 'nav.plain'],
  )
})

test('ts-api：版本读取失败时给出「未知」而不是抛异常', () => {
  assert.equal(
    installedVersion(() => {
      throw new Error('读不到 typescript')
    }),
    '未知',
  )
  assert.match(describeTypeScriptProblem({}, '7.0.2') ?? '', /7\.0\.2/)
})
