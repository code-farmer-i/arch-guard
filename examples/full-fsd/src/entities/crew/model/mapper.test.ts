import assert from 'node:assert/strict'
import { test } from 'node:test'
import { toCrew } from './mapper.ts'

test('crew：DTO → 领域实体是显式映射（后端字段改名时这里会报类型错）', () => {
  assert.deepEqual(toCrew({ id: 'c1', name: 'crews' }), { id: 'c1', name: 'crews' })
})
