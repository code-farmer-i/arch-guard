import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { run } from '../es/cli.js'

/**
 * **违规没有存量豁免**（零容忍）：基线机制已从本体移除。
 *
 * 这一组盯的就是"有没有一键洗白通道"：
 *   1. 就算手写一份 `arch.baseline.json`，违规照报（文件被忽略，并明确提示）；
 *   2. `--update-baseline` 开关本身不存在（未知参数 → 退出 2）；
 *   3. 唯一的例外通道是 config 的 `exempt`，而它**必须写理由**（没理由 = 加载期报错）；
 *   4. `--update-coverage` 只刷新**覆盖率**棘轮快照（M04），与"豁免违规"无关。
 */
const PACKAGE_ROOT = fileURLToPath(new URL('..', import.meta.url))
const INDEX_URL = pathToFileURL(join(PACKAGE_ROOT, 'es/index.js')).href

async function runCli(args, cwd) {
  const lines = []
  const errors = []
  const originalLog = console.log
  const originalError = console.error
  const originalCwd = process.cwd()
  console.log = (line = '') => lines.push(String(line))
  console.error = (line = '') => errors.push(String(line))
  try {
    process.chdir(cwd)
    const code = await run(args, {})
    return { code, out: lines.join('\n'), err: errors.join('\n') }
  } finally {
    process.chdir(originalCwd)
    console.log = originalLog
    console.error = originalError
  }
}

/** 一个**确有违规**的最小宿主：`src/shared/lib/a.ts` 是 barrel（S11） */
function makeProject({ config, extraFiles = {} } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'ag-nobl-'))
  mkdirSync(join(dir, 'src/app'), { recursive: true })
  mkdirSync(join(dir, 'src/shared/lib'), { recursive: true })
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({ name: 'nobl', private: true, type: 'module' }),
  )
  writeFileSync(
    join(dir, 'arch.config.mjs'),
    config ??
      `import { canonical, tsPack } from '${INDEX_URL}'\nexport default { packs: [tsPack], presets: [canonical()] }\n`,
  )
  writeFileSync(join(dir, 'src/app/main.tsx'), 'export const boot = 1\n')
  writeFileSync(join(dir, 'src/shared/lib/a.ts'), "export * from './b'\n")
  for (const [rel, text] of Object.entries(extraFiles)) {
    mkdirSync(join(dir, rel.split('/').slice(0, -1).join('/')), { recursive: true })
    writeFileSync(join(dir, rel), text)
  }
  return dir
}

test('违规基线已移除：手写 arch.baseline.json 也不再豁免，并明确提示该文件失效', async () => {
  const dir = makeProject()
  try {
    writeFileSync(
      join(dir, 'arch.baseline.json'),
      `${JSON.stringify({ version: 1, specVersion: '1', entries: [{ rule: 'S11', file: 'src/shared/lib/a.ts', anchor: 'x', anchorKind: 'line' }] }, null, 2)}\n`,
    )
    const result = await runCli([], dir)
    assert.equal(result.code, 1, '有违规就必须红：基线文件不得再起豁免作用')
    assert.match(result.out, /检测到 arch\.baseline\.json：违规基线机制已移除/)
    assert.match(result.out, /\[S11\]/)
    assert.equal(/豁免 \d+/.test(result.out), false, '摘要里不该再出现"豁免 N"')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('--update-baseline 开关不存在：没有一键洗白通道', async () => {
  const dir = makeProject()
  try {
    const gone = await runCli(['--update-baseline'], dir)
    assert.equal(gone.code, 2, '未知开关必须退出 2（而不是写出一份基线）')
    assert.match(gone.out + gone.err, /unknown option|未知/)
    assert.equal(existsSync(join(dir, 'arch.baseline.json')), false, '不许悄悄写出基线文件')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('唯一例外通道 exempt 必须写理由：没理由在配置加载期就报错', async () => {
  const dir = makeProject({
    config: `import { canonical, tsPack } from '${INDEX_URL}'\nexport default {
  packs: [tsPack],
  presets: [canonical()],
  overrides: { exempt: [{ glob: 'src/shared/lib/a.ts' }] },
}\n`,
  })
  try {
    const result = await runCli([], dir)
    assert.equal(result.code, 2, '缺理由的豁免必须 fail-closed')
    assert.match(result.out + result.err, /exempt 的每一条都必须写 reason/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('--update-coverage 只写覆盖率棘轮快照（M04），不豁免任何违规', async () => {
  const metric = (pct) => ({
    lines: { pct },
    branches: { pct },
    functions: { pct },
    statements: { pct },
  })
  const dir = makeProject()
  try {
    const report = join(dir, 'coverage-summary.json')
    writeFileSync(
      report,
      JSON.stringify({
        total: metric(100),
        [`${dir}/src/shared/lib/a.ts`]: metric(100),
      }),
    )
    // 换成带覆盖率棘轮的配置（仍然有 S11 违规）
    writeFileSync(
      join(dir, 'arch.config.mjs'),
      `import { canonical, metrics, tsPack } from '${INDEX_URL}'\nexport default {
  packs: [tsPack],
  presets: [canonical(), metrics({ coverage: { report: 'coverage-summary.json', ratchet: true } })],
}\n`,
    )

    const update = await runCli(['--update-coverage'], dir)
    assert.equal(existsSync(join(dir, 'arch.coverage.json')), true, '快照必须被写下')
    assert.match(update.out, /已写入覆盖率快照/)
    const snapshot = JSON.parse(readFileSync(join(dir, 'arch.coverage.json'), 'utf8'))
    assert.equal(snapshot.lines, 100)
    // 关键：刷新覆盖率快照**不**改变违规的判决
    assert.equal(update.code, 1, '有 S11 违规 → 仍然红')
    assert.match(update.out, /\[S11\]/, '违规照报，快照与豁免无关')

    // 没有启用棘轮时明确说"没写"，而不是静默
    writeFileSync(
      join(dir, 'arch.config.mjs'),
      `import { canonical, metrics, tsPack } from '${INDEX_URL}'\nexport default {
  packs: [tsPack],
  presets: [canonical(), metrics({ coverage: { report: 'coverage-summary.json' } })],
}\n`,
    )
    const off = await runCli(['--update-coverage'], dir)
    assert.match(off.out, /没启用覆盖率棘轮/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
