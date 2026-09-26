import assert from 'node:assert/strict'
import { test } from 'node:test'
import { toOrder } from './mapper.ts'

test('order：DTO → 领域实体是显式映射', () => {
  assert.deepEqual(toOrder({ id: 'o1', total: 3 }), { id: 'o1', total: 3 })
})
