import assert from 'node:assert/strict'
import { test } from 'node:test'
import { toInvoiceRow } from './mapper.ts'

test('billing：DTO → 领域实体是显式映射（含跨域的班组字段）', () => {
  const row = toInvoiceRow({ id: 'i1', amount: 5, crew: 'crews' })
  assert.deepEqual(row, { id: 'i1', amount: 5, crew: 'crews' })
})
