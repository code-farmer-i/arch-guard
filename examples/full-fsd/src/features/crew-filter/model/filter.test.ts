import assert from 'node:assert/strict'
import { test } from 'node:test'
import { applyFilter } from './filter.ts'

/**
 * 纯函数的行为测试（R-122 的建议产物）：筛选是这一层的**行为**，
 * 受控组件只传值 —— 所以它值得一组测试，而不是靠页面手点。
 */
const crews = [
  { id: 'c1', name: 'Alpha' },
  { id: 'c2', name: 'Beta' },
]

test('applyFilter：空关键词原样返回；否则按名字大小写不敏感地筛', () => {
  assert.deepEqual(applyFilter(crews, ''), crews)
  assert.deepEqual(
    applyFilter(crews, '  alp '),
    [crews[0]],
  )
  assert.deepEqual(applyFilter(crews, 'nope'), [])
})
