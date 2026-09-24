import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { aliasesFromTsconfig } from '../es/engine/config.js'
import { parseLocaleFile } from '../es/engine/i18n.js'
import { describeTypeScriptProblem, installedVersion } from '../es/engine/ts-api.js'

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
