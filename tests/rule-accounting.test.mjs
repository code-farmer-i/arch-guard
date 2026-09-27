import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { run } from '../es/cli.js'
import { createRegistry, coreRules, loadConfig } from '../es/index.js'

/**
 * **规则账目**（R-142）：「注册了却没跑」必须说得出是哪几条、为什么。
 *
 * 以前 `registry` 只有 `enabled` / `skipped`（只收"能力未声明"）/ `unknownEnabled` 三个桶 ——
 * 「不在启用名单里」的规则落在**所有桶之外**：报告只印 `规则 70/112`，读者算不出另外那几十条去哪了。
 * 移出名单的唯一信号曾经是"分子 −1"（实测 `dsh-workbench`：`69/112` 与 `70/112` 只差这一个数）。
 */
const PACKAGE_ROOT = fileURLToPath(new URL('..', import.meta.url))
const INDEX_URL = pathToFileURL(join(PACKAGE_ROOT, 'es/index.js')).href

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

/** `library()` 的启用清单是短的 → 必然有"注册了但没启用"的规则（这就是要说的那批） */
function makeLibraryProject(extra = '') {
  const dir = mkdtempSync(join(tmpdir(), 'ag-accounting-'))
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({ name: 'accounting', private: true, type: 'module' }),
  )
  writeFileSync(
    join(dir, 'arch.config.mjs'),
    `import { library, builtinSourceForms } from '${INDEX_URL}'\n` +
      `export default { sourceForm: 'react', presets: [library({ src: 'src', entry: ['index.ts'] })]${extra} }\n`,
  )
  mkdirSync(join(dir, 'src'), { recursive: true })
  writeFileSync(join(dir, 'src/index.ts'), 'export const lib = 1\n')
  return dir
}

const EXAMPLE = join(PACKAGE_ROOT, 'examples', 'full')

test('R-142：报告点名「不在启用名单里」的规则，并给出可执行处方', async () => {
  const dir = makeLibraryProject()
  try {
    const result = await runCli([], dir)
    assert.match(result.out, /未启用 \d+ 条规则（不在配置的 `enable` 名单里）：/)
    assert.match(result.out, /不配 = 不跑，不是通过/, '要给"怎么让它跑"的处方，而不只是报告缺席')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('R-142：账目闭合 —— 跑 + 未启用 + 缺能力 = 注册总数（每一类都有人提）', async () => {
  const dir = makeLibraryProject()
  try {
    const { config } = await loadConfig({ root: dir })
    const registry = createRegistry(coreRules, config)
    const count = (code) => registry.skipped.filter((entry) => entry.code === code).length
    assert.equal(
      registry.enabled.length + registry.skipped.length,
      coreRules.length,
      '注册的规则必须条条有下落（R-142 的核心不变量）',
    )
    assert.ok(count('not-enabled') > 0, 'library() 的清单是短的 → 必然有一批"未启用"')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('R-142：全都在跑的配置里一行都不出现（不制造噪音）', async () => {
  // examples/full 的账目本来就是闭合的（0 条未启用）—— 它不该因此多出任何一行
  const result = await runCli([], EXAMPLE)
  assert.doesNotMatch(result.out, /未启用 \d+ 条规则/)
  assert.doesNotMatch(result.out, /被本次运行的过滤器收窄/)
})

test('R-142：--list-rules 标出每条"跑不跑"，汇总数与账目一致', async () => {
  const dir = makeLibraryProject()
  try {
    const pretty = await runCli(['--list-rules'], dir)
    assert.match(pretty.out, /规则目录：\d+ 条（跑 \d+ · 未启用 \d+/)
    assert.match(pretty.out, /\[未启用\]/, '每条都要有状态标注')
    assert.match(pretty.out, /\[跑\]/)

    const json = JSON.parse((await runCli(['--list-rules', '--format=json'], dir)).out)
    const byState = (state) => json.rules.filter((rule) => rule.state === state).length
    assert.equal(json.total, coreRules.length)
    assert.equal(
      json.rules.length,
      json.rules.filter((rule) => rule.state !== undefined).length,
      '机读目录每条都要带 state',
    )
    assert.equal(
      byState('enabled') + byState('not-enabled') + byState('capability-missing'),
      json.total,
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('R-142：--explain <规则 id> 直接回答「这条在当前配置下跑不跑」', async () => {
  const dir = makeLibraryProject()
  try {
    // `library()` 不启用 S03（应用专属）→ 讲清它没跑，而不是只讲它要求什么
    const skipped = await runCli(['--explain', 'S03'], dir)
    assert.match(skipped.out, /S03 .*\n/)
    assert.match(skipped.out, /当前配置下：没跑 —— 不在启用名单里/)
    assert.doesNotMatch(skipped.out, /当前配置下：会跑/)

    // S21（层序）在 library() 里是启用的 → 讲"会跑"
    const enabled = await runCli(['--explain', 'S21'], dir)
    assert.match(enabled.out, /当前配置下：会跑/)

    const json = JSON.parse((await runCli(['--explain', 'S03', '--format=json'], dir)).out)
    assert.equal(json.rules[0].state, 'not-enabled')
    assert.match(json.rules[0].stateReason, /不在启用名单里/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
