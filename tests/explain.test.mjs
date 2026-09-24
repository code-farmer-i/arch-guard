import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { run } from '../es/cli.js'

/**
 * `--explain <路径>`：**写之前**给出契约（角色 / 能依赖谁 / 该放哪 / 适用规则）。
 *
 * 这是给 agent 的那一半：门禁平时只在事后说"你错了"，而"这个文件是什么角色、能 import 谁、
 * 该放哪"全是既有数据（角色表 + 布局 + 结构声明），一条规则都不用跑 → 零误报。
 * 这一组钉住五件事：命中 / 无处安放（给落点）/ 域外 / ignore / 歧义，以及 JSON 与绝对路径。
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

/** canonical 宿主：给出一份真实角色表，好让 explain 有东西可讲 */
function makeProject(overrides = '') {
  const dir = mkdtempSync(join(tmpdir(), 'ag-explain-'))
  mkdirSync(join(dir, 'src/app'), { recursive: true })
  mkdirSync(join(dir, 'src/modules/crews/views'), { recursive: true })
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({ name: 'explain', private: true, type: 'module' }),
  )
  writeFileSync(
    join(dir, 'arch.config.mjs'),
    `import { canonical, designSystem, copy, tsPack } from '${INDEX_URL}'\n` +
      `export default { packs: [tsPack], presets: [canonical(), designSystem(), copy()]` +
      `${overrides ? `, overrides: ${overrides}` : ''} }\n`,
  )
  writeFileSync(join(dir, 'src/app/main.tsx'), 'export const boot = 1\n')
  writeFileSync(
    join(dir, 'src/modules/crews/views/CrewsPage.tsx'),
    'export default function CrewsPage() {\n  return null\n}\n',
  )
  return dir
}

test('--explain：命中角色时给出层号、依赖规则与落点参数', async () => {
  const dir = makeProject()
  try {
    const result = await runCli(['--explain', 'src/modules/crews/views/CrewsPage.tsx'], dir)
    assert.equal(result.code, 0, '这是查询，不是判决')
    assert.match(result.out, /src\/modules\/crews\/views\/CrewsPage\.tsx/)
    assert.match(result.out, /状态\s+命中角色/)
    assert.match(result.out, /module:views · 层 10/)
    assert.match(result.out, /域 crews/)
    assert.match(result.out, /层序单向：只许依赖层号 ≤ 10/)
    assert.match(
      result.out,
      /域内只许：\.\/ 、@\/src\/modules\/<自己> 、@\/src\/shared\/ 、第三方包/,
    )
    assert.match(result.out, /域外只许 @\/src\/modules\/<域>\/routes/)
    assert.match(result.out, /落点参数.*styleDir=src\/shared\/styles/)
    assert.match(result.out, /落点参数.*i18nDir=src\/shared\/i18n\/locales/)
    assert.match(result.out, /启用规则\s+\d+ 条/, '要把启用的规则连 hint 一起交代')
    assert.equal(/该放哪/.test(result.out), false, '已经落位的文件不该显示错位提示')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('--explain：还没写的路径 → 无处安放 + 明确告诉它该放哪', async () => {
  const dir = makeProject()
  try {
    const result = await runCli(['--explain', 'src/utils/helper.ts'], dir)
    assert.equal(result.code, 0)
    assert.match(result.out, /状态\s+无处安放/)
    assert.match(result.out, /该放哪/)
    assert.match(result.out, /src\/shared/)
    assert.match(result.out, /该路径当前不存在（还没写）/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('--explain：域外的路径只讲"不在契约里"，不倒一堆规则出来', async () => {
  const dir = makeProject()
  try {
    const result = await runCli(['--explain', 'tests/x.test.ts'], dir)
    assert.equal(result.code, 0)
    assert.match(result.out, /状态\s+契约扫描域之外/)
    assert.match(result.out, /不参与目录契约判定/)
    assert.equal(/启用规则/.test(result.out), false, '域外文件列规则会自相矛盾')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('--explain：被 ignore 的路径明确说"完全不属于这个项目"', async () => {
  const dir = makeProject(`{ ignore: ['legacy/**'] }`)
  try {
    const result = await runCli(['--explain', 'legacy/old.ts'], dir)
    assert.equal(result.code, 0)
    assert.match(result.out, /状态\s+被 ignore/)
    assert.match(result.out, /完全不属于这个项目/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('--explain：角色歧义要点出全部命中角色（角色表需要收窄）', async () => {
  const dir = makeProject(
    `{ addRoles: [{ id: 'extra', pattern: 'src/modules/{domain}/views/**', layer: 10 }] }`,
  )
  try {
    const result = await runCli(['--explain', 'src/modules/crews/views/CrewsPage.tsx'], dir)
    assert.equal(result.code, 0)
    assert.match(result.out, /状态\s+歧义/)
    assert.match(result.out, /同时命中 2 个角色（module:views \/ extra）/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('--explain：支持绝对路径与 --format=json（IDE / agent 按文件传参的形态）', async () => {
  const dir = makeProject()
  try {
    const absolute = join(dir, 'src/modules/crews/views/CrewsPage.tsx')
    const result = await runCli(['--explain', absolute], dir)
    assert.equal(result.code, 0)
    assert.match(result.out, /状态\s+命中角色/, '绝对路径必须能归一（否则解释不到任何东西）')

    const json = await runCli(
      ['--explain', 'src/modules/crews/views/CrewsPage.tsx', '--format=json'],
      dir,
    )
    const parsed = JSON.parse(json.out)
    assert.equal(parsed.length, 1)
    assert.equal(parsed[0].status, 'matched')
    assert.equal(parsed[0].role.id, 'module:views')
    assert.equal(parsed[0].role.layer, 10)
    assert.ok(parsed[0].rules.enabled.length > 0)
    assert.equal(parsed[0].contract.layout.modules, 'src/modules')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('--explain：一次可以问多条路径（逗号分隔）', async () => {
  const dir = makeProject()
  try {
    const result = await runCli(['--explain', 'src/app/main.tsx,src/utils/x.ts'], dir)
    assert.equal(result.code, 0)
    assert.match(result.out, /src\/app\/main\.tsx/)
    assert.match(result.out, /src\/utils\/x\.ts/)
    assert.match(result.out, /状态\s+命中角色/)
    assert.match(result.out, /状态\s+无处安放/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
