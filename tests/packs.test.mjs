import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { loadConfig } from '../es/engine/config.js'
import { defaultFramework, frameworkSources } from '../es/data/framework-sources.js'
import { coreRules, reactPack, tsPack } from '../es/index.js'

/**
 * **pack 轴的语义**：pack 的 `framework` 表示**源码形态**，不是"用了哪个框架"。
 *
 * 为什么值得单独钉住：本仓是纯 TS 库/CLI，却曾被 `reactPack` 量 —— 配置里于是出现一句错话
 * （"我用 React"）。根因是 v1 只有一个叫 "react" 的包，而它实际承载的是「TS/TSX parser + 全部规则」。
 * 这一组测试锁住修正后的三条事实：默认形态不是 React、两个包共用一份规则、形态与包只有一处真相。
 */
const PACKAGE_ROOT = fileURLToPath(new URL('..', import.meta.url))
const INDEX_URL = pathToFileURL(join(PACKAGE_ROOT, 'es/index.js')).href

function makeProject() {
  const dir = mkdtempSync(join(tmpdir(), 'ag-pack-'))
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({ name: 'pack-axis', private: true, type: 'module' }),
  )
  return dir
}

test('pack 轴：framework 指的是源码形态；引擎默认不是 React', () => {
  assert.equal(defaultFramework, 'typescript', '默认形态必须是框架无关的 TS，不是 react')
  const ids = frameworkSources.map((item) => item.id)
  assert.deepEqual(ids, ['typescript', 'react', 'vue', 'svelte', 'astro'])
  assert.deepEqual(
    frameworkSources
      .filter((item) => item.implemented)
      .map((item) => item.id),
    ['typescript', 'react'],
    '已实现的只有这两种形态',
  )
  assert.equal(tsPack.framework, 'typescript')
  assert.equal(reactPack.framework, 'react')
})

test('pack 轴：两个包今天共用同一份规则集（谁都不许偷偷多一条/少一条）', () => {
  assert.deepEqual(
    tsPack.rules.map((rule) => rule.id),
    reactPack.rules.map((rule) => rule.id),
    'v1 没有 JSX 专属的已实现规则，所以两者必须完全一致；分化时这条会先红，提醒你更新文档',
  )
  assert.deepEqual(tsPack.rules.map((rule) => rule.id), coreRules.map((rule) => rule.id))
  assert.equal(tsPack.rules.length, coreRules.length)
  assert.deepEqual(tsPack.adapters, reactPack.adapters, '适配面由规则消费的字段决定，两者今天相同')
})

test('pack 轴：packs 决定 metaFramework（一处真相），不一致直接报错', async () => {
  const dir = makeProject()
  try {
    const write = (body) => writeFileSync(join(dir, 'arch.config.mjs'), body)

    write(
      `import { canonical, tsPack } from '${INDEX_URL}'\nexport default { packs: [tsPack], presets: [canonical()] }\n`,
    )
    const ts = await loadConfig({ root: dir })
    assert.equal(ts.config.metaFramework, 'typescript', 'metaFramework 由包给出，不用手写一遍')

    write(
      `import { canonical, reactPack } from '${INDEX_URL}'\nexport default { packs: [reactPack], presets: [canonical()] }\n`,
    )
    const react = await loadConfig({ root: dir })
    assert.equal(react.config.metaFramework, 'react')

    write(
      `import { canonical, tsPack } from '${INDEX_URL}'\nexport default { packs: [tsPack], presets: [canonical()], overrides: { metaFramework: 'react' } }\n`,
    )
    await assert.rejects(
      () => loadConfig({ root: dir }),
      /metaFramework 与框架包不一致/,
      '包与 metaFramework 只能有一处真相',
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
