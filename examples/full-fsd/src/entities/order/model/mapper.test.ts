import assert from 'node:assert/strict'
import { test } from 'node:test'
import { toOrder } from './mapper.ts'

test('order：DTO → 领域实体是显式映射（后端的 crew 字段翻成领域里的 crewId）', () => {
  assert.deepEqual(toOrder({ id: 'o1', total: 3, crew: 'crews' }), {
    id: 'o1',
    total: 3,
    crewId: 'crews',
  })
})
