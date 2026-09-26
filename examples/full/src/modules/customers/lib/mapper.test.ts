import assert from 'node:assert/strict'
import { test } from 'node:test'
import { toCustomerRow } from './mapper.ts'

test('customers：DTO → 领域实体是显式映射', () => {
  const row = toCustomerRow({ id: 'u1', name: 'customers' })
  assert.deepEqual(row, { id: 'u1', name: 'customers' })
})
