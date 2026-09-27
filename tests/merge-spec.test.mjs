import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { MERGE_SPEC, SPECIAL_MERGERS, isWritable } from '../es/engine/merge-spec.js'

/**
 * **合并语义表本身的门禁**（R-144）。
 *
 * 表是"哪把键在这一层是替换、哪把是并集"的唯一真相 —— 所以它必须**不漏、不多、不空转**：
 *
 * 1. **不漏**：`Preset` 与 `ConfigOverrides` 里每个可写的键都要在表里（否则新键没有任何语义声明）；
 * 2. **不多**：表里不许有"哪一层都不存在"的键（拼错的键名会安静地什么都不做）；
 * 3. **不空转**：`special` 的键必须在 `SPECIAL_MERGERS` 里有名字（"特殊"不能是"没人负责"），
 *    而非 `special` 的项目层键必须真的被读（`config.ts` 里要有 `project.<键>`）。
 *
 * 这条守卫的来由：`autoFix`（死键）与 `Preset.metaFramework`（死声明）都是靠手工比对才发现的。
 */
const ROOT = fileURLToPath(new URL('..', import.meta.url))
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')

/** 从接口源码里抠出键名（够用即可：只认「两空格缩进 + 键名 + `?:`/`:`」） */
function interfaceKeys(source, name) {
  const start = source.indexOf(`export interface ${name} {`)
  assert.ok(start > 0, `找不到 interface ${name}`)
  const body = source.slice(start, source.indexOf('\n}', start))
  return new Set([...body.matchAll(/^ {2}([a-zA-Z][a-zA-Z0-9]*)\??:/gm)].map((m) => m[1]))
}

test('R-144：MERGE_SPEC 的键集合 = Preset ∪ ConfigOverrides（不漏、不多）', () => {
  const types = read('src/engine/types.ts')
  const presetKeys = interfaceKeys(types, 'Preset')
  const overrideKeys = interfaceKeys(types, 'ConfigOverrides')
  assert.ok(presetKeys.size >= 12 && overrideKeys.size >= 15, '抠键逻辑变了？')

  const specKeys = new Set(Object.keys(MERGE_SPEC))
  const declared = [...presetKeys, ...overrideKeys].sort()

  assert.deepEqual(
    declared.filter((key) => !specKeys.has(key)).sort(),
    [],
    '这些键可写、却没在 MERGE_SPEC 里声明合并语义（新键不许悄悄获得某种"碰巧"的语义）',
  )

  const owned = new Set(declared)
  assert.deepEqual(
    [...specKeys].filter((key) => !owned.has(key)).sort(),
    [],
    '表里有哪一层都不存在的键（拼错？）—— 它会安静地什么都不做',
  )

  for (const [key, spec] of Object.entries(MERGE_SPEC)) {
    assert.ok(isWritable(spec), `${key} 两根轴都不许写，那它就不该在表里`)
    if (presetKeys.has(key)) {
      assert.notEqual(spec.presets, 'n/a', `${key} 是 Preset 的键，presets 轴不能是 n/a`)
    }
    if (overrideKeys.has(key)) {
      assert.notEqual(spec.project, 'n/a', `${key} 是 ConfigOverrides 的键，project 轴不能是 n/a`)
    }
  }
})

test('R-144：special 的键必须有名字，非 special 的项目层键必须真的被读', () => {
  const config = read('src/engine/config.ts')

  for (const [key, spec] of Object.entries(MERGE_SPEC)) {
    for (const axis of ['presets', 'project']) {
      if (spec[axis] !== 'special') continue
      assert.ok(
        SPECIAL_MERGERS[key] !== undefined,
        `${key} 的 ${axis} 轴是 special，但 SPECIAL_MERGERS 里没有它 —— "特殊"变成了"没人负责"`,
      )
    }
    if (spec.project === 'special' || spec.project === 'n/a') continue
    assert.ok(
      config.includes(`project.${key}`),
      `表说 ${key} 是项目层可合并的（${spec.project}），但 config.ts 里没有读 project.${key} —— 死键`,
    )
  }
})

test('R-144：合并语义只有五种，且 docs 的管理块由表渲染（不手抄）', () => {
  const kinds = new Set(Object.values(MERGE_SPEC).flatMap((spec) => [spec.presets, spec.project]))
  for (const kind of kinds) {
    assert.ok(
      ['single', 'fields', 'union', 'concat', 'special', 'n/a'].includes(kind),
      `未知的合并语义：${kind}`,
    )
  }
})
