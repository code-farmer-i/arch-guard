import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { run } from '../es/cli.js'
import { coreRules, runGuard } from '../es/index.js'

/**
 * 「扫描域空了 / 过滤器把范围缩小到零」这一族假绿的回归测试（全量交叉测试找出来的洞）：
 *   - S24：`include` 非空却 0 个文件 → error（0 个文件 → 通过 是假绿）；
 *   - `--severity` 过滤掉 error 时必须自述（notice + 摘要 + JSON 字段）；
 *   - `--paths` 一个文件都没匹配上时必须自述；
 *   - 这些自述必须**机读可见**（JSON 里有 notices），不能只存在于人读的那一行里。
 */
const PACKAGE_ROOT = fileURLToPath(new URL('..', import.meta.url))
const INDEX_URL = pathToFileURL(join(PACKAGE_ROOT, 'es/index.js')).href

function makeProject({ include, files } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'ag-scan-'))
  mkdirSync(join(dir, 'src/app'), { recursive: true })
  mkdirSync(join(dir, 'src/shared/lib'), { recursive: true })
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({ name: 'scan', private: true, type: 'module' }),
  )
  const override =
    include === undefined ? '' : `, overrides: { include: ${JSON.stringify(include)} }`
  writeFileSync(
    join(dir, 'arch.config.mjs'),
    `import { canonical } from '${INDEX_URL}'\nexport default { presets: [canonical()]${override} }\n`,
  )
  const source = files ?? { 'src/shared/lib/a.ts': "export * from './b'\n" }
  for (const [rel, text] of Object.entries(source)) {
    mkdirSync(join(dir, rel.split('/').slice(0, -1).join('/')), { recursive: true })
    writeFileSync(join(dir, rel), text)
  }
  return dir
}

async function runCli(args, cwd) {
  const lines = []
  const originalLog = console.log
  const originalCwd = process.cwd()
  console.log = (line = '') => lines.push(String(line))
  try {
    process.chdir(cwd)
    const code = await run(args, {})
    return { code, out: lines.join('\n') }
  } finally {
    process.chdir(originalCwd)
    console.log = originalLog
  }
}

/* ---------------- S24 契约扫描域不得为空 ---------------- */

test('S24：include 非空却 0 个文件 → error，且标为全局（scope 过滤时默认仍然失败）', async () => {
  const dir = makeProject({ include: ['app-src/**'] })
  try {
    const result = await runGuard({ cwd: dir, rules: coreRules, quiet: true })
    const s24 = result.active.find((finding) => finding.rule === 'S24')
    assert.ok(s24, 'S24 必须报出来（否则"0 个文件 → 通过"就是假绿）')
    assert.equal(s24.global, true, '不可归属到某个文件 → 必须标全局，不能在 --changed 下被静默丢弃')
    assert.equal(s24.file, 'app-src/**', '用扫描域本身当发现项的"文件"（没有具体文件可归属）')
    assert.equal(result.exitCode, 1)

    // 对照：域内确实没有任何文件被判定，但域外有（说明不是"项目是空的"，而是 glob 写错了）
    const cli = await runCli([], dir)
    assert.match(cli.out, /契约扫描域 app-src\/\*\*/)
    assert.match(cli.out, /\[S24\]/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('S24：域内有文件就不报（正常项目零噪音）', async () => {
  const dir = makeProject()
  try {
    const result = await runGuard({ cwd: dir, rules: coreRules, quiet: true })
    assert.equal(
      result.all.some((finding) => finding.rule === 'S24'),
      false,
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('include 未限制 + 空仓库：不报 error，但必须自述"没有任何东西被判定"（人读 + 机读）', async () => {
  const dir = makeProject({ include: [], files: {} })
  try {
    const result = await runGuard({ cwd: dir, rules: coreRules, quiet: true })
    assert.equal(
      result.active.some((finding) => finding.rule === 'S24'),
      false,
      'include 为空 = 不限扫描域：空仓库是合法形态，不该报 error',
    )

    const cli = await runCli([], dir)
    assert.match(cli.out, /全项目 0 个 ts\/css 文件/)
    const json = JSON.parse((await runCli(['--format=json'], dir)).out)
    // 按**稳定 code** 判（文案不是契约，想改就改）
    assert.ok(
      json.notices.some((notice) => notice.code === 'scan-empty'),
      '机读侧也要看得到（不然 CI 只看 exit 0）',
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

/* ---------------- 过滤器必须自述 ---------------- */

test('--severity：过滤掉 error 时必须自述，且 API / notice / JSON 三处都有条数', async () => {
  const dir = makeProject()
  try {
    const strict = await runGuard({ cwd: dir, rules: coreRules, quiet: true })
    assert.ok(strict.active.length > 0, '前提：项目本身有 error')
    assert.equal(strict.filteredBySeverity, 0)

    const warned = await runGuard({ cwd: dir, rules: coreRules, severity: 'warn', quiet: true })
    const severityOf = new Map(coreRules.map((rule) => [rule.id, rule.severity]))
    const warnCount = strict.active.filter((f) => severityOf.get(f.rule) === 'warn').length
    assert.equal(warned.active.length, warnCount, '过滤后只剩 warn')
    assert.equal(
      warned.filteredBySeverity,
      strict.active.length - warnCount,
      'API 侧给出被过滤条数',
    )
    assert.equal(warned.exitCode, 0, '过滤后没有 error，退出码随之归零')

    const cli = await runCli(['--severity=warn'], dir)
    assert.match(cli.out, /--severity=warn：另有 \d+ 条 finding 被过滤/)
    assert.match(cli.out, /--severity 过滤 \d+ 条/, '摘要行也要自述')

    const json = JSON.parse((await runCli(['--severity=warn', '--format=json'], dir)).out)
    assert.equal(json.filteredBySeverity, strict.active.length - warnCount, '机读侧不许静默丢弃')
    assert.ok(json.notices.some((notice) => notice.code === 'severity-filtered'))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('--paths：一个文件都没匹配上时必须自述（路径打错 = 什么都没查）', async () => {
  const dir = makeProject()
  try {
    const missed = await runCli(['--paths=src/typo/**', '--format=json'], dir)
    const miss = JSON.parse(missed.out)
    assert.equal(miss.paths.matched, 0, '机读侧要能直接判"一个都没匹配上"')
    assert.ok(miss.notices.some((notice) => notice.code === 'paths-no-match'))
    assert.equal(miss.ok, true, '没有违规，所以 ok 仍是 true —— 靠 paths/退出码区分"没判"')
    assert.equal(missed.code, 2, '请求无法满足（什么都没判）→ 非零退出，CI 里路径打错不会静默变绿')

    const hit = JSON.parse(
      (await runCli(['--paths=src/shared/lib/a.ts', '--format=json'], dir)).out,
    )
    assert.equal(hit.paths.matched, 1, '匹配上了就给出命中数')
    assert.equal(
      hit.notices.some((notice) => notice.code === 'paths-no-match'),
      false,
      '匹配上了就不该有这条提示',
    )
    assert.ok(hit.findings.some((finding) => finding.rule === 'S11'))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('项目边界：通用产物目录默认不进文件集（data 表兜底，宿主忘了写 ignore 也不吃亏）', async () => {
  const dir = makeProject()
  try {
    for (const name of ['.next', 'dist', '.svelte-kit']) {
      mkdirSync(join(dir, name, 'deep'), { recursive: true })
      writeFileSync(join(dir, name, 'deep', 'generated.ts'), "export * from './x'\n")
    }
    const result = await runGuard({ cwd: dir, rules: coreRules, quiet: true })
    assert.equal(
      result.all.some(
        (finding) => finding.file.includes('.next/') || finding.file.includes('dist/'),
      ),
      false,
      '产物目录里的代码不该被判定（也不该拖慢解析）',
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('ignore（项目边界）跳过了什么必须自述 —— 否则"悄无声息地不判了"', async () => {
  const dir = makeProject({ include: ['src/**'] })
  try {
    mkdirSync(join(dir, 'legacy'), { recursive: true })
    writeFileSync(join(dir, 'legacy', 'old.ts'), "export * from './x'\n")
    writeFileSync(
      join(dir, 'arch.config.mjs'),
      `import { canonical } from '${INDEX_URL}'\n` +
        `export default { presets: [canonical()], overrides: { include: ['src/**'], ignore: ['legacy/**'] } }\n`,
    )
    const cli = await runCli([], dir)
    // 计数里还会含 canonical() 默认 ignore 的 arch.config.mjs —— 断言"报出来了且有数"，不锁死具体数字
    assert.match(cli.out, /ignore（项目边界）命中 \d+ 个文件/)
    assert.match(cli.out, /legacy\/\*\*/)
    const json = JSON.parse((await runCli(['--format=json'], dir)).out)
    assert.ok(json.notices.some((notice) => notice.code === 'ignore-skipped'))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
