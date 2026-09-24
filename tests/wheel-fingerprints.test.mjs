import assert from 'node:assert/strict'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { run } from '../es/cli.js'
import { wheelFingerprints } from '../es/data/wheel-fingerprints.js'

/**
 * 手工轮子指纹表（`src/data/wheel-fingerprints.ts`）——**数据也要被审计**。
 *
 * 这一组来自一次深度审计，一次抓出三类问题（都是一句话能说清、但没人验过的东西）：
 *   ① **平台能力的豁免条件写反**：`if (entry.platform === true) return true` → 命中即 `continue`，
 *      于是 deep-clone / unique-id / number-format / deep-equal / query-string **五个能力从来没报过**。
 *      能活下来是因为**没有任何夹具覆盖它们**（`datetime` 夹具只覆盖 datetime，`deps` 只覆盖 cli-args）。
 *   ② **`allowOwn` 没生效**：数据表说"只提示不报错"，实现只往 hint 追加一句话，finding 仍是 error。
 *   ③ **名册式枚举**：`getDay` / `argv[2]` / 宽松 `==` / `toString(16)` 这类同族写法全漏在外面。
 */
const PACKAGE_ROOT = fileURLToPath(new URL('..', import.meta.url))
const FIXTURE = join(PACKAGE_ROOT, '__fixtures__/wheels')

async function runCli(args, cwd) {
  const lines = []
  const originalLog = console.log
  const originalCwd = process.cwd()
  console.log = (line = '') => lines.push(String(line))
  try {
    process.chdir(cwd)
    return { code: await run(args, {}), out: lines.join('\n') }
  } finally {
    process.chdir(originalCwd)
    console.log = originalLog
  }
}

const report = async () => JSON.parse((await runCli(['--format=json'], FIXTURE)).out)

test('数据表自检：每个能力都真的能开火，且命名指纹必须与弱指纹成对', () => {
  for (const entry of wheelFingerprints) {
    const strong = entry.syntax ?? []
    const soft = entry.softSyntax ?? []
    const apiNames = entry.apiNames ?? []
    assert.ok(
      strong.length > 0 || (soft.length > 0 && apiNames.length > 0),
      `${entry.capability} 既没有强指纹、也没有"弱指纹 + 命名指纹" → 这条能力永远不会开火（死声明）`,
    )
    assert.ok(
      apiNames.length === 0 || soft.length > 0,
      `${entry.capability} 写了 apiNames 却没有 softSyntax → P07 需要"弱指纹 且 自研同名"，命名指纹永远读不到`,
    )
    assert.ok(entry.hint.length > 0, `${entry.capability} 缺 hint：报错必须告诉人怎么改`)
  }
})

test('平台能力命中即报（此前五个平台能力全部静默失效）', async () => {
  const json = await report()
  const files = json.findings.map((finding) => finding.file)
  for (const file of [
    'src/shared/lib/clone-json.ts', // deep-clone
    'src/shared/lib/unique-id.ts', // unique-id
    'src/shared/lib/number-format.ts', // number-format
    'src/shared/lib/deep-equal.ts', // deep-equal（宽松 `==`）
    'src/shared/lib/query-string.ts', // query-string
  ]) {
    assert.ok(files.includes(file), `${file} 应当被报（平台能力没有 import 可查 → 命中即报）`)
  }
})

test('allowOwn 的能力真的降级为 warn（不是只改 hint）', async () => {
  const json = await report()
  const byFile = new Map(json.findings.map((finding) => [finding.file, finding]))
  assert.equal(
    byFile.get('src/shared/lib/query-string.ts')?.severity,
    'warn',
    'query-string 在能力表里标了 allowOwn → 机读侧必须能看到 warn（而不是 error）',
  )
  assert.equal(
    byFile.get('src/shared/lib/clone-json.ts')?.severity,
    'error',
    '平台能力的命中仍是 error',
  )
  // counts 也走同一个判据（severityOf 是唯一读取点）
  assert.equal(json.errors, 5)
  assert.equal(json.warnings, 2)
})

test('合规写法零命中：structuredClone / crypto.randomUUID / Intl / isDeepStrictEqual / URLSearchParams', async () => {
  const json = await report()
  assert.equal(
    json.findings.some((finding) => finding.file === 'src/shared/lib/compliant.ts'),
    false,
    '用了平台内置的写法不该被点名',
  )
})

test('覆盖缺口：argv 索引取值 / 宽松 `==` / 自研递归克隆都要抓得到', async () => {
  const json = await report()
  const byFile = new Map(json.findings.map((finding) => [finding.file, finding]))
  // `process.argv[2]`（旧模式只认 argv.slice/indexOf/…）
  assert.ok(byFile.has('src/shared/lib/argv.ts'))
  // `JSON.stringify(a) == JSON.stringify(b)`（旧模式只认 `===`）
  assert.equal(byFile.get('src/shared/lib/deep-equal.ts')?.rule, 'P06')
  // 自研递归克隆（不走 JSON 技巧 → 只有 P07 抓得到）
  assert.equal(byFile.get('src/shared/lib/clone-recursive.ts')?.rule, 'P07')
})
