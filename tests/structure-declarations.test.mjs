import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  mergeStructureSpec,
  resolveStructure,
  StructureDeclarationError,
} from '../es/engine/structure.js'

const roles = [
  {
    id: 'fsd:pages:index',
    pattern: 'src/pages/{slice}/index.ts',
    layer: 5,
    group: 'slice',
    entry: true,
  },
  { id: 'fsd:pages:ui', pattern: 'src/pages/{slice}/ui/**', layer: 5, group: 'slice' },
  { id: 'fsd:shared:lib', pattern: 'src/shared/lib/**', layer: 1 },
]

test('结构声明：没声明时每个字段都补齐（数组为空、布尔为 false）', () => {
  const resolved = resolveStructure({ roles })
  assert.equal(resolved.order, false)
  assert.deepEqual(resolved.isolate, [])
  assert.deepEqual(resolved.publicApi, [])
  assert.deepEqual(resolved.publicApiUnits, [])
  assert.deepEqual(resolved.segmentedGroups, [])
  assert.deepEqual(resolved.reservedNames, [])
  assert.deepEqual(resolved.groupCountLimits, [])
  assert.deepEqual(resolved.directoryItemLimits, [])
  assert.deepEqual(resolved.groupInDegree, [])
  assert.deepEqual(resolved.nameCollisions, [])
  assert.deepEqual(resolved.repetitiveNaming, [])
  assert.deepEqual(resolved.pluralConsistency, [])
  assert.deepEqual(resolved.degreeLimits, [])
  assert.deepEqual(resolved.importLocality, [])
})

test('结构声明：预设与 overrides 是加法（布尔取或、字符串数组取并集、带键数组拼接）', () => {
  const resolved = resolveStructure({
    preset: {
      order: true,
      isolate: ['slice'],
      reservedNames: ['ui'],
      groupCountLimits: [{ dimension: 'slice', max: 20 }],
    },
    overrides: {
      isolate: ['slice', 'segment'],
      reservedNames: ['lib'],
      publicApiUnits: [{ role: 'fsd:shared:lib', children: true }],
    },
    roles: [...roles, { id: 'x', pattern: 'src/x/{segment}/**', layer: 2, group: 'segment' }],
  })
  assert.equal(resolved.order, true)
  assert.deepEqual(resolved.isolate, ['slice', 'segment'])
  assert.deepEqual(resolved.reservedNames, ['ui', 'lib'])
  assert.deepEqual(resolved.groupCountLimits, [{ dimension: 'slice', max: 20 }])
  assert.deepEqual(resolved.publicApiUnits, [{ role: 'fsd:shared:lib', children: true }])
})

test('结构声明：维度名必须真实存在（否则这条声明永远不会生效）', () => {
  assert.throws(
    () =>
      resolveStructure({
        preset: { isolate: ['slice'] },
        roles: [{ id: 'a', pattern: 'src/a/**', layer: 1 }],
      }),
    (error) => {
      assert.ok(error instanceof StructureDeclarationError)
      assert.match(error.message, /没有任何角色用它做组维度/)
      return true
    },
  )
})

test('结构声明：指向的角色不在角色表里 → 直接报错（声明了却不生效 = 静默失能）', () => {
  assert.throws(
    () =>
      resolveStructure({
        preset: { publicApiUnits: [{ role: 'nope' }] },
        roles,
      }),
    (error) => {
      assert.ok(error instanceof StructureDeclarationError)
      assert.match(error.message, /不在角色表里/)
      return true
    },
  )
  assert.throws(
    () => resolveStructure({ preset: { directoryItemLimits: [{ role: 'nope', max: 3 }] }, roles }),
    StructureDeclarationError,
  )
})

test('结构声明：degreeLimits 按键合并，且必须真的给一个上限', () => {
  const resolved = resolveStructure({
    preset: { degreeLimits: [{ role: 'a', maxIn: 3 }] },
    overrides: {
      degreeLimits: [
        { role: 'a', maxIn: 5 },
        { role: 'b', maxOut: 2 },
      ],
    },
    roles: [
      { id: 'a', pattern: 'src/a/**', layer: 1 },
      { id: 'b', pattern: 'src/b/**', layer: 1 },
    ],
  })
  assert.deepEqual(resolved.degreeLimits, [
    { role: 'a', maxIn: 5 },
    { role: 'b', maxOut: 2 },
  ])
  assert.throws(
    () =>
      resolveStructure({
        preset: { degreeLimits: [{ role: 'a' }] },
        roles: [{ id: 'a', pattern: 'src/a/**', layer: 1 }],
      }),
    /既没给 maxIn 也没给 maxOut/,
  )
})

test('结构声明：overrides 是显式覆盖（预设给默认，宿主调数值）', () => {
  const resolved = resolveStructure({
    preset: { groupCountLimits: [{ dimension: 'slice', max: 20 }] },
    overrides: { groupCountLimits: [{ dimension: 'slice', max: 3 }] },
    roles,
  })
  assert.deepEqual(resolved.groupCountLimits, [{ dimension: 'slice', max: 3 }])
})

test('结构声明：同一份来源里出现两份不同声明 → 报错（两个真相不许静默取一个）', () => {
  assert.throws(
    () =>
      resolveStructure({
        // 两个预设拼接后落到同一个 preset 上：同一维度两份不同数值
        preset: {
          groupInDegree: [
            { dimension: 'slice', min: 1 },
            { dimension: 'slice', min: 2 },
          ],
        },
        roles,
      }),
    (error) => {
      assert.ok(error instanceof StructureDeclarationError)
      assert.match(error.message, /有两份不同的声明/)
      return true
    },
  )
  const same = resolveStructure({
    preset: { groupInDegree: [{ dimension: 'slice', min: 1 }] },
    overrides: { groupInDegree: [{ dimension: 'slice', min: 1 }] },
    roles,
  })
  assert.deepEqual(same.groupInDegree, [{ dimension: 'slice', min: 1 }])
})

test('结构声明：字段顺序不同不算差异（避免宿主的写法影响判定）', () => {
  const resolved = resolveStructure({
    preset: { nameCollisions: [{ dimension: 'slice', names: ['ui'] }] },
    overrides: { nameCollisions: [{ names: ['ui'], dimension: 'slice' }] },
    roles,
  })
  assert.deepEqual(resolved.nameCollisions, [{ dimension: 'slice', names: ['ui'] }])
})

test('mergeStructureSpec：两个预设的结构声明相加而不是覆盖', () => {
  const merged = mergeStructureSpec(
    { order: true, isolate: ['a'], repetitiveNaming: ['slice'] },
    { isolate: ['b'], reservedNames: ['ui'], pluralConsistency: [{ dimension: 'slice' }] },
  )
  assert.equal(merged.order, true)
  assert.deepEqual(merged.isolate, ['a', 'b'])
  assert.deepEqual(merged.repetitiveNaming, ['slice'])
  assert.deepEqual(merged.reservedNames, ['ui'])
  assert.deepEqual(merged.pluralConsistency, [{ dimension: 'slice' }])
  assert.deepEqual(mergeStructureSpec(undefined, { order: true }), { order: true })
  assert.deepEqual(mergeStructureSpec({ order: true }, undefined), { order: true })
})
