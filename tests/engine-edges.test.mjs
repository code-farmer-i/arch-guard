import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { aliasesFromTsconfig, loadConfig } from '../es/engine/config.js'
import { parseLocaleFile } from '../es/engine/i18n.js'
import { describeTypeScriptProblem } from '../es/engine/ts-api.js'
import { reactRules } from '../es/packs/react/index.js'
import { reactPack, runGuard } from '../es/index.js'

const PACKAGE_ROOT = fileURLToPath(new URL('..', import.meta.url))
const INDEX_URL = pathToFileURL(join(PACKAGE_ROOT, 'es/index.js')).href

/** 建一个最小项目：一条 canonical 配置 + 一个会触发 H03 的文件 */
function makeProject() {
  const dir = mkdtempSync(join(tmpdir(), 'ag-edge-'))
  mkdirSync(join(dir, 'src/app'), { recursive: true })
  mkdirSync(join(dir, 'src/shared/lib'), { recursive: true })
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({ name: 'edge', private: true, type: 'module' }),
  )
  writeFileSync(
    join(dir, 'arch.config.mjs'),
    `import { canonical } from '${INDEX_URL}'\nexport default { presets: [canonical()] }\n`,
  )
  writeFileSync(join(dir, 'src/app/main.tsx'), 'export const boot = 1\n')
  writeFileSync(
    join(dir, 'src/shared/lib/a.ts'),
    'export function a(): void {\n  console.log("问题")\n}\n',
  )
  writeFileSync(
    join(dir, 'src/shared/lib/b.ts'),
    'export function b(): void {\n  console.log("另一个问题")\n}\n',
  )
  return dir
}

test('config：找不到配置文件 / specVersion 不认识 / 缺 layout 都显式报错（不回退猜测）', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ag-cfg-'))
  try {
    await assert.rejects(() => loadConfig({ root: dir }), /找不到配置文件/)

    writeFileSync(join(dir, 'arch.config.mjs'), `export default { specVersion: '2' }\n`)
    await assert.rejects(() => loadConfig({ root: dir }), /specVersion 不支持/)

    writeFileSync(join(dir, 'arch.config.mjs'), 'export default { overrides: { roles: [] } }\n')
    await assert.rejects(() => loadConfig({ root: dir }), /layout|roles/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('config：metaFramework 认不出 / 还没有 pack 时直接拒绝（防「0 文件 → 通过」的假绿）', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ag-fw-'))
  try {
    const write = (framework) =>
      writeFileSync(
        join(dir, 'arch.config.mjs'),
        `import { canonical } from '${INDEX_URL}'\n` +
          `export default { presets: [canonical()], overrides: { metaFramework: '${framework}' } }\n`,
      )

    write('nope')
    await assert.rejects(() => loadConfig({ root: dir }), /未知的 metaFramework/)

    write('vue')
    await assert.rejects(() => loadConfig({ root: dir }), /还没有 vue 框架包/)

    // 不写就是已实现的那个（react），必须能正常加载
    writeFileSync(
      join(dir, 'arch.config.mjs'),
      `import { canonical } from '${INDEX_URL}'\nexport default { presets: [canonical()] }\n`,
    )
    const { config } = await loadConfig({ root: dir })
    assert.equal(config.metaFramework, 'react')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('config：规则集由框架包决定，且 pack 与 metaFramework 只有一处真相', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ag-pack-'))
  try {
    const write = (body) => writeFileSync(join(dir, 'arch.config.mjs'), body)
    const head = `import { canonical, reactPack } from '${INDEX_URL}'\n`

    write(`${head}export default { presets: [canonical()], packs: [reactPack] }\n`)
    const loaded = await loadConfig({ root: dir })
    assert.equal(loaded.config.metaFramework, 'react', 'metaFramework 由包给出，不用再手写一遍')
    assert.deepEqual(
      loaded.packs.map((pack) => pack.id),
      ['react'],
    )
    assert.ok(loaded.packs[0].rules.length > 0, '包自带规则集')

    write(`${head}export default { presets: [canonical()], packs: [reactPack, reactPack] }\n`)
    await assert.rejects(() => loadConfig({ root: dir }), /只允许一个框架包/)

    write(
      `${head}export default { presets: [canonical()], packs: [reactPack], ` +
        `overrides: { metaFramework: 'vue' } }\n`,
    )
    await assert.rejects(() => loadConfig({ root: dir }), /不一致/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('runGuard：不给 rules 时用框架包（CLI 走的路），一个包都没有则明确报错', async () => {
  const dir = makeProject()
  try {
    const result = await runGuard({ cwd: dir, fallbackPacks: [reactPack], quiet: true })
    assert.equal(result.config.metaFramework, 'react')
    assert.ok(result.stats.length > 0, '兜底包生效，规则真的跑了')

    await assert.rejects(
      () => runGuard({ cwd: dir, quiet: true }),
      /没有任何可跑的规则/,
      '没包又没 rules 时必须报错，而不是「跑 0 条规则 → 通过」',
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('scan：当前 pack 量不了的源码（.vue）进 foreign，而不是被静默丢掉', async () => {
  const { config } = await loadConfig({ root: `${PACKAGE_ROOT}__fixtures__/framework-gap` })
  const { scanProject } = await import('../es/index.js')
  const scan = scanProject(config)
  assert.deepEqual(scan.foreign, ['src/modules/crews/views/OldPage.vue'])
  assert.ok(
    !scan.files.includes('src/modules/crews/views/OldPage.vue'),
    '量不了的文件不该混进文件集参与图判定',
  )
})

test('aliases：根 tsconfig 只有 references 时顺着引用链取 paths（Vite 官方模板形态）', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ag-ts-'))
  try {
    writeFileSync(
      join(dir, 'tsconfig.json'),
      JSON.stringify({
        files: [],
        references: [{ path: './tsconfig.app.json' }, { path: './tsconfig.node.json' }],
      }),
    )
    writeFileSync(
      join(dir, 'tsconfig.app.json'),
      JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@/*': ['./src/*'] } } }),
    )
    const found = aliasesFromTsconfig(dir)
    assert.equal(found.aliases['@'], 'src')
    assert.match(found.notice ?? '', /references/)

    // 没有 tsconfig / 没有 paths 时返回空，而不是自己猜一个
    const empty = mkdtempSync(join(tmpdir(), 'ag-ts2-'))
    assert.deepEqual(aliasesFromTsconfig(empty).aliases, {})
    writeFileSync(
      join(empty, 'tsconfig.json'),
      JSON.stringify({ compilerOptions: { strict: true } }),
    )
    assert.deepEqual(aliasesFromTsconfig(empty).aliases, {})
    rmSync(empty, { recursive: true, force: true })
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('i18n：字符串键与数字键也能还原成键路径', () => {
  const parsed = parseLocaleFile(
    'src/shared/i18n/locales/en/nav.ts',
    "export default {\n  'nav-title': 'Title',\n  404: 'Not found',\n}\n",
    'src/shared/i18n/locales',
  )
  assert.deepEqual(
    parsed?.keys.map((key) => key.path),
    ['nav.nav-title', 'nav.404'],
  )
})

test('ts-api：非对象导出给出可执行报错，而不是让人看 undefined', () => {
  assert.match(describeTypeScriptProblem(undefined) ?? '', /没有导出任何东西/)
  assert.match(describeTypeScriptProblem({ createSourceFile: () => {} }) ?? '', /ScriptKind/)
})

test('run：没有 git 时 scope=changed 降级全量并显式给出 notice', async () => {
  const dir = makeProject()
  try {
    const result = await runGuard({ cwd: dir, rules: reactRules, scope: 'changed', quiet: true })
    assert.ok(result.all.length > 0)
    assert.equal(result.scope, 'changed')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('run：git 仓库里 scope=changed/staged 只报告变更文件，--local-only 另行处理', async () => {
  const dir = makeProject()
  const git = (...args) =>
    execFileSync('git', ['-C', dir, ...args], {
      encoding: 'utf8',
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 't',
        GIT_AUTHOR_EMAIL: 't@t',
        GIT_COMMITTER_NAME: 't',
        GIT_COMMITTER_EMAIL: 't@t',
      },
    })
  try {
    git('init')
    git('add', '-A')
    git('commit', '-m', 'init')
    writeFileSync(
      join(dir, 'src/shared/lib/a.ts'),
      'export function a(): void {\n  console.log("改过的文件")\n  debugger\n}\n',
    )

    const changed = await runGuard({ cwd: dir, rules: reactRules, scope: 'changed', quiet: true })
    // scope 只过滤**报告**（active），不影响正确性判定（all）—— 这是防「假绿」的设计
    assert.deepEqual(changed.scopeFiles, ['src/shared/lib/a.ts'])
    assert.ok(changed.active.some((finding) => finding.file === 'src/shared/lib/a.ts'))
    assert.equal(
      changed.active.some((finding) => finding.file === 'src/shared/lib/b.ts'),
      false,
      '未变更的文件不该出现在增量报告里',
    )
    assert.ok(
      changed.all.some((finding) => finding.file === 'src/shared/lib/b.ts'),
      '但 all 里必须仍然保留它（否则增量会变成假绿）',
    )

    const staged = await runGuard({ cwd: dir, rules: reactRules, scope: 'staged', quiet: true })
    assert.equal(
      staged.active.some((finding) => finding.file === 'src/shared/lib/a.ts'),
      false,
      '没 staged 就不报',
    )

    git('add', '-A')
    const stagedNow = await runGuard({ cwd: dir, rules: reactRules, scope: 'staged', quiet: true })
    assert.ok(stagedNow.active.some((finding) => finding.file === 'src/shared/lib/a.ts'))

    const since = await runGuard({ cwd: dir, rules: reactRules, scope: 'since:HEAD', quiet: true })
    assert.ok(Array.isArray(since.all))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('run：--paths 接受绝对路径（IDE / lint 工具按文件传参的形态）', async () => {
  const dir = makeProject()
  try {
    mkdirSync(join(dir, 'src/modules/demo'), { recursive: true })
    writeFileSync(join(dir, 'src/modules/demo/helper.ts'), 'export const helper = 1\n')
    const absolute = await runGuard({
      cwd: dir,
      rules: reactRules,
      quiet: true,
      paths: [join(dir, 'src/modules/demo/helper.ts')],
    })
    assert.deepEqual(
      absolute.active.map((finding) => finding.file),
      ['src/modules/demo/helper.ts'],
      '绝对路径必须能匹配（否则静默假绿）',
    )
    const relativeRun = await runGuard({
      cwd: dir,
      rules: reactRules,
      quiet: true,
      paths: ['src/modules/demo/helper.ts'],
    })
    assert.equal(relativeRun.active.length, 1, '相对路径照常工作')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
