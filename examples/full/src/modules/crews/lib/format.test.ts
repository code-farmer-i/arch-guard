import assert from 'node:assert/strict'
import { test } from 'node:test'
import { formatCrewName } from './format'

test('格式化带上了日期后缀', () => {
  assert.match(formatCrewName('crews'), /crews · \d{4}-\d{2}-\d{2}/)
})
