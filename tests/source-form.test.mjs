import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { defaultFramework, frameworkSources } from '../es/data/framework-sources.js'
import { builtinSourceForms, coreRules, loadConfig } from '../es/index.js'

/**
 * **源码形态轴的语义**（R-143 / [ADR-0009](../../docs/adr/0009-source-form-is-a-scalar.md)）：
 *
 * 1. 形态是**一个标量**（`sourceForm`），一处真相 —— 以前它同时写在 `packs[0].framework`、
 *    `overrides.metaFramework` 里（还要互校），另有一处 `Preset.metaFramework` 是死声明；
 * 2. 数据层（`data/framework-sources.ts`）**只说"认识哪些形态、各自管哪些扩展名"**；
 *    "哪个形态有实现"是层 4 的事实（`packs/registry.ts` 的绑定），由调用方注入；
 * 3. 宿主**不再接触"包"**：加自己的规则写 `overrides.customRules`（下一组测试）。
 */
const PACKAGE_ROOT = fileURLToPath(new URL('..', import.meta.url))
const INDEX_URL = pathToFileURL(join(PACKAGE_ROOT, 'es/index.js')).href

function makeProject() {
  const dir = mkdtempSync(join(tmpdir(), 'ag-source-form-'))
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({ name: 'source-form', private: true, type: 'module' }),
  )
  const write = (body) => writeFileSync(join(dir, 'arch.config.mjs'), body)
  return { dir, write, head: `import { canonical } from '${INDEX_URL}'\n` }
}

test('数据表：形态是纯数据（没有 implemented 这种派生量），默认形态不是 React', () => {
  assert.equal(defaultFramework, 'typescript', '默认形态必须是框架无关的 TS，不是 react')
  assert.deepEqual(
    frameworkSources.map((item) => item.id),
    ['typescript', 'react', 'vue', 'svelte', 'astro'],
  )
  // 「有没有实现」是派生量：手写一个 `implemented` 标志就是第二处真相（ADR-0009）
  assert.deepEqual(Object.keys(frameworkSources[0]).sort(), ['extensions', 'id'])
})

test('内置绑定：两个形态今天共用同一份规则集与同一张适配面（分化时这条会先红）', () => {
  assert.deepEqual(
    builtinSourceForms.map((item) => item.id),
    ['typescript', 'react'],
  )
  for (const binding of builtinSourceForms) {
    assert.deepEqual(
      binding.rules.map((rule) => rule.id),
      coreRules.map((rule) => rule.id),
      'v1 没有 JSX 专属的已实现规则，所以两者必须一致',
    )
  }
  assert.deepEqual(
    builtinSourceForms[0].adapters,
    builtinSourceForms[1].adapters,
    '适配面由规则实际消费的字段决定 —— 两者跑同一份规则，就不该为了"看起来有区别"少写一个面',
  )
})

test('配置：sourceForm 是标量（省略=默认形态），形态只在一处', async () => {
  const { dir, write, head } = makeProject()
  try {
    write(
      `${head}export default { specVersion: '2', sourceForm: 'react', presets: [canonical()] }\n`,
    )
    const react = await loadConfig({ root: dir })
    assert.equal(react.config.sourceForm, 'react')

    write(`${head}export default { specVersion: '2', presets: [canonical()] }\n`)
    const fallback = await loadConfig({ root: dir })
    assert.equal(fallback.config.sourceForm, 'typescript', '省略 = 数据表里第一条')

    // 形态只在一处：`overrides.sourceForm` 是个不认识的键（显式枚举的 ConfigOverrides 里没有它）
    write(
      `${head}export default { specVersion: '2', presets: [canonical()], overrides: { sourceForm: 'react' } }\n`,
    )
    await assert.rejects(() => loadConfig({ root: dir }), /overrides 里有不认识的键：sourceForm/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('配置：认不出的形态 / 有绑定但缺这个形态 → 都是配置期 fail-closed', async () => {
  const { dir, write, head } = makeProject()
  try {
    write(
      `${head}export default { specVersion: '2', sourceForm: 'nope', presets: [canonical()] }\n`,
    )
    await assert.rejects(() => loadConfig({ root: dir }), /未知的 sourceForm：nope/)

    // 声明 vue（数据表认识、但没有实现）：注入的绑定表里没有它 → 拒绝，而不是「0 文件 → 通过」
    write(`${head}export default { specVersion: '2', sourceForm: 'vue', presets: [canonical()] }\n`)
    await assert.rejects(
      () => loadConfig({ root: dir, sourceForms: builtinSourceForms }),
      /本工具还没有 vue 的实现/,
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('调用方一行都没注入时不抛：规则集为空 + 自述（配置语义照常解析）', async () => {
  const { dir, write, head } = makeProject()
  try {
    write(
      `${head}export default { specVersion: '2', sourceForm: 'react', presets: [canonical()] }\n`,
    )
    const loaded = await loadConfig({ root: dir })
    assert.deepEqual(loaded.config.rules, [], '没有实现就只能是空集')
    assert.ok(
      loaded.notices.some((notice) => notice.code === 'source-form-missing'),
      '空规则集必须自述 —— 否则又是一处静默',
    )
    assert.equal(loaded.config.sourceForm, 'react', '配置语义本身照常解析出来')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('customRules：追加进 config.rules（同 id 同 title 幂等 / 不同 title 配置期报错）', async () => {
  const { dir } = makeProject()
  const write = (body) => writeFileSync(join(dir, 'arch.config.mjs'), body)
  const head = `import { canonical, coreRules } from '${INDEX_URL}'\n`
  try {
    // 幂等：把内置规则原样再声明一遍不算冲突（`customRules: [...coreRules]` 应当是安全的）
    write(
      `${head}export default { specVersion: '2', sourceForm: 'typescript', presets: [canonical()],\n` +
        `  overrides: { customRules: [...coreRules] } }\n`,
    )
    const idempotent = await loadConfig({ root: dir, sourceForms: builtinSourceForms })
    assert.equal(
      idempotent.config.rules.length,
      coreRules.length,
      '同 id 同 title 是可重复声明的（追加语义 = 并集）',
    )

    // 冲突：同 id 不同 title → 配置期就报（不许后来者静默覆盖前者）
    write(
      `${head}export default { specVersion: '2', sourceForm: 'typescript', presets: [canonical()],\n` +
        `  overrides: { customRules: [{ ...coreRules[0], title: '我自己的说法' }] } }\n`,
    )
    await assert.rejects(
      () => loadConfig({ root: dir, sourceForms: builtinSourceForms }),
      /有两份不同的实现/,
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
