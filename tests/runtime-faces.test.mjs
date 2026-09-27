import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { coreRules, loadConfig, runGuard } from '../es/index.js'

/**
 * 运行时面与面值（R-139 / R-140，ADR-0008）。
 *
 * 夹具 `runtime-faces` 钉的是"最终该报什么"；这里钉的是**声明语义**：
 *   1. 声明必须自洽（面指向未声明的运行时 = 那档静默不生效 → 配置期拦下）；
 *   2. **空声明即不判**（既有宿主零影响）；
 *   3. 消费者的运行时按**可达性**推导 —— 于是同构模块可用任意面、孤儿不判。
 */
const ES = new URL('../es/index.js', import.meta.url).href

/** 最小双运行时工程：`structure` 是 overrides.structure，`files` 是 rel → 源码 */
function project(structure, files) {
  const dir = mkdtempSync(join(tmpdir(), 'ag-faces-'))
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({ name: 'faces', private: true, type: 'module' }),
  )
  writeFileSync(
    join(dir, 'tsconfig.json'),
    JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@/*': ['./src/*'] } } }),
  )
  writeFileSync(
    join(dir, 'arch.config.mjs'),
    `import { library } from '${ES}'\n` +
      `export default { specVersion: '2', presets: [library({ src: 'src',\n` +
      `  entry: ['app/host.ts', 'app/client.tsx'],\n` +
      `  modules: { shared: 1, 'modules/a': 10, 'app/layouts': 10 } })],\n` +
      `  overrides: { enable: ['S23'], ignore: ['arch.config.mjs'], structure: ${JSON.stringify(structure)} } }\n`,
  )
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(join(dir, rel, '..'), { recursive: true })
    writeFileSync(join(dir, rel), text)
  }
  return dir
}

const RUNTIMES = [
  { name: 'host', entries: ['src/app/host.ts'] },
  { name: 'client', entries: ['src/app/client.tsx'] },
]
const FACES = [
  { pattern: 'src/modules/*/index.ts', runtime: 'host', value: '*Host' },
  { pattern: 'src/modules/*/client.ts', runtime: 'client', value: '*Client' },
]

/** 双运行时 + 一个域（宿主面 / 浏览器面）的最小骨架 */
const BASE_FILES = {
  'src/app/host.ts': "import { aHost } from '@/modules/a'\nexport const host = aHost\n",
  'src/app/client.tsx':
    "import { aClient } from '@/modules/a/client'\nexport const client = aClient\n",
  'src/modules/a/index.ts': 'export const aHost = 1\n',
  'src/modules/a/client.ts': 'export const aClient = 1\n',
}

const findingsOf = async (dir) => {
  const result = await runGuard({ cwd: dir, ruleSet: coreRules, cache: false })
  return result.all.map((item) => `${item.rule}|${item.file}`)
}

test('R-139：面指向未声明的运行时 → 配置期就拦（否则那档静默不生效）', async () => {
  await assert.rejects(
    () => loadConfig({ root: project({ faces: FACES }, BASE_FILES) }),
    /指向未声明的运行时/,
  )
  await assert.rejects(
    () => loadConfig({ root: project({ runtimes: [{ name: 'host', entries: [] }] }, BASE_FILES) }),
    /没给入口/,
  )
  await assert.rejects(
    () =>
      loadConfig({ root: project({ runtimes: RUNTIMES, faces: [{ pattern: '' }] }, BASE_FILES) }),
    /非空 pattern/,
  )
})

test('R-139/R-140：空声明即不判 —— 没声明 runtimes / faces 时两档都不跑', async () => {
  const dir = project(
    {},
    {
      // 宿主入口引浏览器面（声明了就是违规）、面文件导出内部实现（声明了就是违规）
      'src/app/host.ts':
        "import { aClient } from '@/modules/a/client'\nexport const host = aClient\n",
      'src/app/client.tsx': 'export const client = 1\n',
      'src/modules/a/index.ts': 'export const aHost = 1\nexport const innerService = 1\n',
      'src/modules/a/client.ts': 'export const aClient = 1\n',
    },
  )
  assert.deepEqual(await findingsOf(dir), [], '没声明就一条都不许报（既有宿主零影响）')
})

test('R-139：消费者的运行时按可达性推导 —— 同构模块可用任意面、孤儿不判', async () => {
  const isomorphic = project(
    { runtimes: RUNTIMES, faces: FACES },
    {
      ...BASE_FILES,
      'src/app/host.ts': "import { iso } from '@/shared/lib/iso'\nexport const host = iso\n",
      'src/app/client.tsx': "import { iso } from '@/shared/lib/iso'\nexport const client = iso\n",
      // 两个入口都可达 → 两个运行时都算它的家 → 用宿主面是合法的
      'src/shared/lib/iso.ts': "import { aHost } from '@/modules/a'\nexport const iso = aHost\n",
    },
  )
  assert.deepEqual(
    await findingsOf(isomorphic),
    [],
    '同构模块从两个入口都可达，用任意面都不该报（实测 workbench 的纯函数域模型就是这个形状）',
  )

  const orphan = project(
    { runtimes: RUNTIMES, faces: FACES },
    {
      ...BASE_FILES,
      'src/app/layouts/Orphan.tsx':
        "import { aHost } from '@/modules/a'\nexport const Orphan = aHost\n",
    },
  )
  const orphanFindings = await findingsOf(orphan)
  assert.equal(
    orphanFindings.filter((item) => item.includes('Orphan')).length,
    0,
    '孤儿（哪个运行时都到不了）不判运行时面 —— S15 已经报孤儿，不重复',
  )
})

test('R-139：跨运行时走错面要报，走对不报（宿主侧只能进宿主面）', async () => {
  const wrong = project(
    { runtimes: RUNTIMES, faces: FACES },
    {
      ...BASE_FILES,
      'src/app/host.ts':
        "import { aClient } from '@/modules/a/client'\nexport const host = aClient\n",
    },
  )
  assert.deepEqual(await findingsOf(wrong), ['S23|src/app/host.ts'])

  const right = project({ runtimes: RUNTIMES, faces: FACES }, BASE_FILES)
  assert.deepEqual(await findingsOf(right), [])
})
