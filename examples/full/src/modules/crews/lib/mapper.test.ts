import assert from 'node:assert/strict'
import { test } from 'node:test'
import { toCrewRow } from './mapper.ts'

test('crews：DTO → 领域实体是显式映射（后端字段改名时这里会报类型错）', () => {
  const row = toCrewRow({ id: 'c1', name: 'crews' })
  assert.deepEqual(row, { id: 'c1', name: 'crews' })
})
