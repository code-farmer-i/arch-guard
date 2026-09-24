import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { run } from '../es/cli.js'
import { gitIgnoredPaths } from '../es/engine/git.js'
import { coreRules, loadConfig, scanProject, runGuard } from '../es/index.js'

/**
 * **`.gitignore` 作为基础忽略层**（宿主 `ignore` 继续在其上追加）。
 *
 * 语义边界（都由 git 自己判定，我们不解析 `.gitignore`）：
 *   1. 只作用于**契约域外**：契约域内（`include` 命中）的文件即使被 gitignore 也照判 ——
 *      宁可吵（生成物被报出来，宿主去 ignore 里显式声明），也不静默不判；
 *   2. **git 的语义而不是朴素解析**：`!` 否定、子目录各自的 .gitignore、`.git/info/exclude` 都生效；
 *   3. 被跟踪的文件永远不受 .gitignore 影响（所以提交在仓库里的源码不会被误跳）；
 *   4. 取不到 git → 整层降级关闭，行为与从前一致；
 *   5. 跳过了什么必须**自述**。
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
    const code = await run(args, {})
    return { code, out: lines.join('\n') }
  } finally {
    process.chdir(originalCwd)
    console.log = originalLog
  }
}

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 't',
  GIT_AUTHOR_EMAIL: 't@t',
  GIT_COMMITTER_NAME: 't',
  GIT_COMMITTER_EMAIL: 't@t',
}

/** 有 git 的宿主：src 已提交；`gen/` 与 `gitignore` 内容由用例决定（不提交 → 保持未跟踪） */
function makeRepo(gitignore, extraFiles = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'ag-vcs-'))
  mkdirSync(join(dir, 'src/app'), { recursive: true })
  mkdirSync(join(dir, 'src/shared/lib'), { recursive: true })
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({ name: 'vcs', private: true, type: 'module' }),
  )
  writeFileSync(
    join(dir, 'arch.config.mjs'),
    `import { canonical, tsPack } from '${INDEX_URL}'\nexport default { packs: [tsPack], presets: [canonical()] }\n`,
  )
  writeFileSync(join(dir, 'src/app/main.tsx'), 'export const boot = 1\n')
  writeFileSync(join(dir, 'src/shared/lib/a.ts'), 'export const a = 1\n')
  writeFileSync(join(dir, '.gitignore'), `${gitignore}\n`)
  for (const [rel, text] of Object.entries(extraFiles)) {
    mkdirSync(join(dir, rel.split('/').slice(0, -1).join('/')), { recursive: true })
    writeFileSync(join(dir, rel), text)
  }
  execFileSync('git', ['-C', dir, 'init'], { stdio: 'ignore' })
  execFileSync('git', ['-C', dir, 'add', 'src', 'package.json', '.gitignore', 'arch.config.mjs'], {
    stdio: 'ignore',
    env: GIT_ENV,
  })
  execFileSync('git', ['-C', dir, 'commit', '-m', 'init'], { stdio: 'ignore', env: GIT_ENV })
  return dir
}

test('git 忽略层：契约域外 + 被 .gitignore 忽略 → 连解析都不做，并自述条数', async () => {
  const dir = makeRepo('gen/', { 'gen/bad.ts': "export * from './x'\n" })
  try {
    const scan = scanProject((await loadConfig({ root: dir })).config, {
      vcsIgnored: gitIgnoredPaths(dir) ?? undefined,
    })
    assert.ok(
      scan.vcsIgnored.some((rel) => rel.startsWith('gen/')),
      '被 gitignore 的契约域外文件应进 vcsIgnored（不解析）',
    )
    assert.equal(
      scan.outside.some((record) => record.rel.startsWith('gen/')),
      false,
      '被 gitignore 的域外文件不该再进 outside（那会照常解析）',
    )
    const cli = await runCli([], dir)
    assert.match(cli.out, /因 \.gitignore（git 判定）跳过 \d+ 个文件/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('git 的语义而不是朴素解析：`!` 重新纳入 + 目录内部救不回来这两条都对', async () => {
  // 写法必须是 `gen/*` + `!gen/keep.ts`：git 规定**被忽略的目录内部**无法再用 `!` 救回文件
  // （`gen/` + `!gen/keep.ts` 里 keep.ts 仍然是被忽略的）—— 这类语义自己解析十有八九会写错。
  const dir = makeRepo('gen/*\n!gen/keep.ts', {
    'gen/keep.ts': 'export const keep = 1\n',
    'gen/other.ts': "export * from './x'\n",
  })
  try {
    const ignored = gitIgnoredPaths(dir)
    assert.ok(ignored)
    const isIgnored = (rel) =>
      ignored.files.has(rel) || ignored.dirs.some((item) => rel.startsWith(item))
    assert.equal(isIgnored('gen/keep.ts'), false, '`!` 必须真的重新纳入')
    assert.equal(isIgnored('gen/other.ts'), true, '没被否定覆盖的照旧忽略')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('契约域内不受 .gitignore 影响：被 gitignore 的 src 文件照常判定（宁可吵）', async () => {
  const dir = makeRepo('src/shared/lib/new.ts', {
    'src/shared/lib/new.ts': "export * from './y'\n",
  })
  try {
    const ignored = gitIgnoredPaths(dir)
    assert.ok(ignored?.files.has('src/shared/lib/new.ts'), '前提：git 确实忽略了它（未跟踪）')
    const result = await runGuard({ cwd: dir, rules: coreRules, quiet: true })
    assert.ok(
      result.all.some(
        (finding) => finding.rule === 'S11' && finding.file === 'src/shared/lib/new.ts',
      ),
      '契约域内的文件即使被 gitignore 也必须照判（否则是静默不判）',
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('与宿主 ignore 是叠加关系：.gitignore 是基础，ignore 继续追加', async () => {
  const dir = makeRepo('gen/', {
    'gen/bad.ts': "export * from './x'\n",
    'legacy/old.ts': "export * from './z'\n",
  })
  try {
    writeFileSync(
      join(dir, 'arch.config.mjs'),
      `import { canonical, tsPack } from '${INDEX_URL}'\nexport default { packs: [tsPack], presets: [canonical()], overrides: { ignore: ['legacy/**'] } }\n`,
    )
    const scan = scanProject((await loadConfig({ root: dir })).config, {
      vcsIgnored: gitIgnoredPaths(dir) ?? undefined,
    })
    assert.ok(
      scan.vcsIgnored.some((rel) => rel.startsWith('gen/')),
      '.gitignore 这一层生效',
    )
    assert.ok(
      scan.ignored.some((rel) => rel.startsWith('legacy/')),
      '宿主 ignore 这一层同样生效',
    )
    const cli = await runCli([], dir)
    assert.match(cli.out, /因 \.gitignore（git 判定）跳过 \d+ 个文件/)
    assert.match(cli.out, /ignore（项目边界）命中 \d+ 个文件/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('没有 git 时整层关闭：行为与从前一致（不报 .gitignore 提示）', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ag-novcs-'))
  try {
    mkdirSync(join(dir, 'src/app'), { recursive: true })
    mkdirSync(join(dir, 'gen'), { recursive: true })
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'novcs', private: true, type: 'module' }),
    )
    writeFileSync(
      join(dir, 'arch.config.mjs'),
      `import { canonical, tsPack } from '${INDEX_URL}'\nexport default { packs: [tsPack], presets: [canonical()] }\n`,
    )
    writeFileSync(join(dir, 'src/app/main.tsx'), 'export const boot = 1\n')
    writeFileSync(join(dir, '.gitignore'), 'gen/\n')
    writeFileSync(join(dir, 'gen/bad.ts'), "export * from './x'\n")

    assert.equal(gitIgnoredPaths(dir), null, '没有 git 就没有这一层')
    const cli = await runCli([], dir)
    assert.equal(/因 \.gitignore/.test(cli.out), false)
    assert.match(cli.out, /契约扫描域 src\/\*\*/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
