import assert from 'node:assert/strict'
import { test } from 'node:test'
import { toOrderRow } from './mapper.ts'

test('orders：DTO → 领域实体是显式映射', () => {
  const row = toOrderRow({ id: 'o1', total: 3 })
  assert.deepEqual(row, { id: 'o1', total: 3 })
})
