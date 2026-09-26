import { cacheDirOf } from '../es/engine/facts-cache.js'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { reactPack } from '../es/packs/react/index.js'
import { FACTS_CACHE_SPEC } from '../es/engine/facts-cache.js'

const PACKAGE_ROOT = fileURLToPath(new URL('..', import.meta.url))
const INDEX_URL = pathToFileURL(join(PACKAGE_ROOT, 'es/index.js')).href

/** 最小工程：一个入口 + 一个可被改坏的文件 */
function makeProject() {
  const dir = mkdtempSync(join(tmpdir(), 'ag-cache-'))
  mkdirSync(join(dir, 'src/app'), { recursive: true })
  mkdirSync(join(dir, 'src/shared/lib'), { recursive: true })
  writeFileSync(
    join(dir, 'arch.config.mjs'),
    `import { canonical, hygiene } from '${INDEX_URL}'\n` +
      `export default { presets: [canonical(), hygiene()] }\n`,
  )
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'cache-fixture' }))
  writeFileSync(
    join(dir, 'src/app/main.tsx'),
    `import { thing } from '../shared/lib/thing'\nvoid thing\n`,
  )
  writeFileSync(join(dir, 'src/shared/lib/thing.ts'), 'export const thing = 1\n')
  return dir
}

const run = (dir, extra = {}) =>
  runGuard({ cwd: dir, fallbackPacks: [reactPack], quiet: true, ...extra })
const cachePath = (dir) => join(dir, '.arch-guard-cache', 'facts.json.gz')

test('facts 缓存：第二次运行全部命中，且发现项一致', async () => {
  const dir = makeProject()
  try {
    const cold = await run(dir)
    assert.equal(cold.cache.hits, 0, '第一次没有缓存可命中')
    assert.ok(cold.cache.misses > 0)

    const warm = await run(dir)
    assert.equal(warm.cache.misses, 0, '没改文件就不该重新解析')
    assert.ok(warm.cache.hits > 0)
    assert.deepEqual(warm.all, cold.all, '命中缓存不能改变结论')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('facts 缓存：改了内容必须重算，绝不复用旧事实（防假绿）', async () => {
  const dir = makeProject()
  try {
    const first = await run(dir)
    assert.equal(first.all.length, 0)

    // 引入一条真实违规：barrel 再导出（S11）
    writeFileSync(join(dir, 'src/shared/lib/thing.ts'), `export * from './other'\n`)
    const second = await run(dir)
    assert.equal(second.cache.misses, 1, '改过的那个文件必须重算')
    assert.ok(
      second.all.some((finding) => finding.rule === 'S11'),
      '改动带来的违规必须报出来 —— 否则缓存就是假绿',
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('facts 缓存：缓存损坏 / 规范版本不符都整份作废并说明原因', async () => {
  const dir = makeProject()
  try {
    const baseline = await run(dir)

    // ① 规范版本不符
    mkdirSync(join(dir, '.arch-guard-cache'), { recursive: true })
    writeFileSync(
      cachePath(dir),
      gzipSync(JSON.stringify({ spec: 'old', typescript: '0', files: { x: {} } })),
    )
    const stale = await run(dir)
    assert.equal(stale.cache.hits, 0)
    assert.deepEqual(stale.all, baseline.all, '作废后重算，结论不变')

    // ② 文件损坏（不是 gzip）
    writeFileSync(cachePath(dir), 'not gzip at all')
    const broken = await run(dir)
    assert.equal(broken.cache.hits, 0)
    assert.deepEqual(broken.all, baseline.all)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('facts 缓存：--no-cache 等价于永远不命中，且不写缓存', async () => {
  const dir = makeProject()
  try {
    await run(dir)
    rmSync(join(dir, '.arch-guard-cache'), { recursive: true, force: true })

    const cold = await run(dir, { cache: false })
    assert.equal(cold.cache.hits, 0)
    assert.ok(cold.cache.misses > 0)
    assert.throws(() => readFileSync(cachePath(dir)), /ENOENT/, '--no-cache 不该留下缓存文件')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('facts 缓存：角色变了也要重算（role 进单文件键）', async () => {
  const dir = makeProject()
  try {
    await run(dir)
    // 换一套角色表：thing.ts 从 shared:lib 变成别的角色 → 缓存里的 role 不再匹配
    writeFileSync(
      join(dir, 'arch.config.mjs'),
      `import { canonical, hygiene } from '${INDEX_URL}'\n` +
        `export default {\n` +
        `  presets: [canonical(), hygiene()],\n` +
        `  overrides: { roles: canonical().roles?.map((role) =>\n` +
        `    role.id === 'shared:lib' ? { ...role, id: 'shared:lib2' } : role) },\n` +
        `}\n`,
    )
    const after = await run(dir)
    assert.equal(after.cache.misses, 1, 'role 变了，那个文件必须重算')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('facts 缓存：有 node_modules 时写进它里面（跟 Vite 一样，宿主不用配 .gitignore）', async () => {
  const dir = makeProject()
  try {
    mkdirSync(join(dir, 'node_modules'), { recursive: true })
    await run(dir)
    readFileSync(join(dir, 'node_modules', '.arch-guard-cache', 'facts.json.gz'))
    assert.throws(
      () => readFileSync(join(dir, '.arch-guard-cache', 'facts.json.gz')),
      /ENOENT/,
      '有 node_modules 时不该再往项目根写',
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('facts 缓存：写盘内容带规范版本与 TypeScript 版本（换解析器时能整份作废）', async () => {
  const dir = makeProject()
  try {
    await run(dir)
    const raw = JSON.parse(
      (await import('node:zlib')).gunzipSync(readFileSync(cachePath(dir))).toString('utf8'),
    )
    assert.equal(raw.spec, FACTS_CACHE_SPEC)
    assert.equal(typeof raw.typescript, 'string')
    assert.ok(raw.typescript.length > 0)
    assert.ok(Object.keys(raw.files).length > 0)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('R-132：缓存默认塞进 node_modules，没有时才退回项目根（跟 Vite 同一策略）', () => {
  // 只测**位置选择**这层逻辑：那条自述的文案是消息、不是契约（按 code 判，不匹配措辞）。
  // 退回项目根的情形会在 facts-cache 自述里多一句"记得加进 .gitignore"（手测两套示例 / 本仓确认过）。
  const dir = mkdtempSync(join(tmpdir(), 'ag-cache-'))
  try {
    assert.equal(cacheDirOf(dir), join(dir, '.arch-guard-cache'), '没有 node_modules → 项目根')
    mkdirSync(join(dir, 'node_modules'), { recursive: true })
    assert.equal(
      cacheDirOf(dir),
      join(dir, 'node_modules', '.arch-guard-cache'),
      '有 node_modules → 塞进去（天然被 git 忽略、rm -rf 顺手带走）',
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
