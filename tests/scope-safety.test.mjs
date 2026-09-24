import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { run } from '../es/cli.js'
import { reactRules, runGuard } from '../es/index.js'

/**
 * scope 的安全语义（docs/DESIGN.md §6.8 / PARADIGM.md §9）—— 这一组测试盯的是
 * **最危险的一类缺陷：门禁说"通过"，而它其实没有检查将提交的东西**。
 *
 * 三件事必须有夹具钉住：
 *  1. `--scope=staged` 判的是 **index 内容**，不是工作区（`git add` 之后又改了文件 —— hook 经典 bug）；
 *  2. `--local-only` 跳过的全局违规条数必须可见（人读 notice + 机读 JSON 字段）；
 *  3. rename / 仓库根 ≠ 配置根 的路径换算不能把变更集算空（算空 = 假绿）。
 */

const PACKAGE_ROOT = fileURLToPath(new URL('..', import.meta.url))
const INDEX_URL = pathToFileURL(join(PACKAGE_ROOT, 'es/index.js')).href

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 't',
  GIT_AUTHOR_EMAIL: 't@t',
  GIT_COMMITTER_NAME: 't',
  GIT_COMMITTER_EMAIL: 't@t',
}

function makeProject(prefix = 'ag-scope-') {
  const dir = mkdtempSync(join(tmpdir(), prefix))
  mkdirSync(join(dir, 'src/app'), { recursive: true })
  mkdirSync(join(dir, 'src/shared/lib'), { recursive: true })
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({ name: 'scope', private: true, type: 'module' }),
  )
  writeFileSync(
    join(dir, 'arch.config.mjs'),
    `import { canonical } from '${INDEX_URL}'\nexport default { presets: [canonical()] }\n`,
  )
  writeFileSync(join(dir, 'src/app/main.tsx'), 'export const boot = 1\n')
  return dir
}

function gitIn(dir) {
  return (...args) =>
    execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', env: GIT_ENV, stdio: 'pipe' })
}

/** 同进程跑 CLI（spawn 的覆盖率不会合并进父进程；同进程也更快） */
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

/* ---------------- ① staged 判 index 内容，不判工作区 ---------------- */

test('scope=staged：判的是 index 内容，工作区里未暂存的改动不算数（hook 经典 bug）', async () => {
  const dir = makeProject()
  const git = gitIn(dir)
  try {
    // index 里是干净的 a.ts，工作区里是"还没 add 的下一版"（barrel → S11）
    writeFileSync(join(dir, 'src/shared/lib/a.ts'), 'export const a = 1\n')
    git('init')
    git('add', '-A')
    git('commit', '-m', 'init')

    writeFileSync(join(dir, 'src/shared/lib/a.ts'), "export * from './b'\n")

    const stagedClean = await runGuard({
      cwd: dir,
      rules: reactRules,
      scope: 'staged',
      quiet: true,
    })
    assert.equal(
      stagedClean.active.some((finding) => finding.rule === 'S11'),
      false,
      '工作区里那份 barrel 还没 add，staged 不该报它（否则 hook 会拦住用户没打算提交的改动）',
    )
    // 对照组：同一个文件在全量下确实会报 —— 证明上一条不是"规则根本没跑"
    const full = await runGuard({ cwd: dir, rules: reactRules, scope: 'full', quiet: true })
    assert.ok(
      full.active.some(
        (finding) => finding.rule === 'S11' && finding.file === 'src/shared/lib/a.ts',
      ),
      '工作区那份确实违规（说明 staged 的"不报"来自读了 index，而不是规则失效）',
    )

    // 把违规版本 add 进去 → staged 必须报（证明它读的确实是 index 的内容）
    git('add', '-A')
    const stagedDirty = await runGuard({
      cwd: dir,
      rules: reactRules,
      scope: 'staged',
      quiet: true,
    })
    assert.ok(
      stagedDirty.active.some(
        (finding) => finding.rule === 'S11' && finding.file === 'src/shared/lib/a.ts',
      ),
      'index 里的违规必须报出来（漏报就是假绿：hook 放行了坏代码）',
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('scope=staged：取不到 index blob 的文件要明说退回工作区，不静默换语义', async () => {
  const dir = makeProject()
  const git = gitIn(dir)
  try {
    writeFileSync(join(dir, 'src/shared/lib/a.ts'), "export * from './b'\n")
    git('init')
    git('add', '-A')
    git('commit', '-m', 'init')
    // staged 删除：index 里没有它的 blob（文件还在工作区）
    git('rm', '--cached', 'src/shared/lib/a.ts')

    const staged = await runGuard({ cwd: dir, rules: reactRules, scope: 'staged', quiet: true })
    assert.ok(
      staged.active.some((finding) => finding.file === 'src/shared/lib/a.ts'),
      'blob 取不到时退回工作区内容（宁多报不漏报）',
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

/* ---------------- ② --local-only 的跳过条数必须可见 ---------------- */

test('scope=changed + --local-only：跳过的全局违规条数在 API / notice / JSON 三处都可见', async () => {
  const dir = makeProject()
  const git = gitIn(dir)
  try {
    // a.ts 是语法坏文件（S00 解析失败 → global，归不到任何变更文件上）
    writeFileSync(join(dir, 'src/shared/lib/a.ts'), 'export function main( {\n  return\n')
    git('init')
    git('add', '-A')
    git('commit', '-m', 'init')
    // 变更落在入口文件上：它本身不产生任何非全局违规，于是"是否阻断"只取决于全局违规
    writeFileSync(join(dir, 'src/app/main.tsx'), 'export const boot = 2\n')

    // 默认：不可归属的全局违规仍然失败（不许静默丢弃）
    const strict = await runGuard({ cwd: dir, rules: reactRules, scope: 'changed', quiet: true })
    const globalCount = strict.active.filter((finding) => finding.global).length
    assert.ok(globalCount > 0, '默认必须仍然报全局违规')
    assert.equal(strict.skippedGlobals, 0)
    assert.equal(strict.exitCode, 1, '有全局 error 就必须非零退出')

    // --local-only：放行，但条数必须交代
    const local = await runGuard({
      cwd: dir,
      rules: reactRules,
      scope: 'changed',
      localOnly: true,
      quiet: true,
    })
    assert.equal(
      local.active.some((finding) => finding.rule === 'S00'),
      false,
    )
    assert.equal(local.skippedGlobals, globalCount, 'API 侧必须给出跳过条数')
    assert.equal(local.exitCode, 0, '--local-only 下全局违规不再阻断')

    const cli = await runCli(['--scope=changed', '--local-only'], dir)
    assert.equal(cli.code, 0)
    assert.match(cli.out, new RegExp(`--local-only：跳过 ${globalCount} 条不可归属的全局违规`))
    assert.match(cli.out, new RegExp(`--local-only 跳过全局违规 ${globalCount}`), '摘要也要自述')

    const json = await runCli(['--scope=changed', '--local-only', '--format=json'], dir)
    assert.equal(JSON.parse(json.out).skippedGlobals, globalCount, '机读侧同样不许静默丢弃')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

/* ---------------- ③ rename / 仓库根 ≠ 配置根 ---------------- */

test('scope=changed：rename 后的新路径必须进变更集（否则改名 = 免检）', async () => {
  const dir = makeProject()
  const git = gitIn(dir)
  try {
    writeFileSync(join(dir, 'src/shared/lib/a.ts'), "export * from './b'\n")
    git('init')
    git('add', '-A')
    git('commit', '-m', 'init')

    mkdirSync(join(dir, 'src/shared/lib/nested'), { recursive: true })
    git('mv', 'src/shared/lib/a.ts', 'src/shared/lib/nested/a.ts')

    const changed = await runGuard({ cwd: dir, rules: reactRules, scope: 'changed', quiet: true })
    assert.ok(
      changed.scopeFiles.includes('src/shared/lib/nested/a.ts'),
      '改名后的新路径必须在变更集里（否则改名 = 免检）',
    )
    assert.ok(
      changed.active.some(
        (finding) => finding.rule === 'S11' && finding.file === 'src/shared/lib/nested/a.ts',
      ),
      '改名后的文件要照常被规则判定（不是"删+增"里被丢掉的那一半）',
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('scope=changed：配置根不是仓库根时，变更路径换算到配置根（并自述）', async () => {
  const repo = mkdtempSync(join(tmpdir(), 'ag-repo-'))
  const dir = join(repo, 'packages/app')
  mkdirSync(join(dir, 'src/app'), { recursive: true })
  mkdirSync(join(dir, 'src/shared/lib'), { recursive: true })
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({ name: 'sub', private: true, type: 'module' }),
  )
  writeFileSync(
    join(dir, 'arch.config.mjs'),
    `import { canonical } from '${INDEX_URL}'\nexport default { presets: [canonical()] }\n`,
  )
  writeFileSync(join(dir, 'src/app/main.tsx'), 'export const boot = 1\n')
  writeFileSync(join(dir, 'src/shared/lib/a.ts'), "export * from './b'\n")
  const git = gitIn(repo)
  try {
    git('init')
    git('add', '-A')
    git('commit', '-m', 'init')
    writeFileSync(join(dir, 'src/shared/lib/a.ts'), "export * from './c'\n")

    const changed = await runGuard({ cwd: dir, rules: reactRules, scope: 'changed', quiet: true })
    assert.deepEqual(
      changed.scopeFiles,
      ['src/shared/lib/a.ts'],
      '路径必须换算到配置根（不换算就一条都对不上 → 假绿）',
    )
    assert.ok(changed.active.some((finding) => finding.rule === 'S11'))
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})
