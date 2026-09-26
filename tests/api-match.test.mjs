import assert from 'node:assert/strict'
import { test } from 'node:test'

import { apiMatchOf, matchesApi } from '../es/engine/api-match.js'

/**
 * `apis` 的匹配语义（R-115）**只此一处**：以前有四份副本、两套规则 ——
 * `callSites` 与自述认"整名 / 对象前缀 / 方法后缀"，D24/D25/D29 只认"整名 / 方法后缀"，
 * 于是 `can.has('crew:edit')` 规则不判、自述却说命中（替漏判打掩护）。
 */

test('匹配三形态：整名 / 对象前缀 / 方法后缀 —— 且都有 `.` 边界（不是子串）', () => {
  assert.equal(apiMatchOf('fetch', ['fetch']), 'fetch', '整名')
  assert.equal(apiMatchOf('localStorage.getItem', ['localStorage']), 'localStorage', '对象前缀')
  assert.equal(
    apiMatchOf('queryClient.invalidateQueries', ['invalidateQueries']),
    'invalidateQueries',
    '方法后缀',
  )
  // 边界：子串不算命中（否则 `can` 会吃掉 `cancel` / `candidate`）
  assert.equal(apiMatchOf('cancel', ['can']), null)
  assert.equal(apiMatchOf('candidate', ['can']), null)
  assert.equal(apiMatchOf('fetchX', ['fetch']), null, '前缀必须带 `.`')
  assert.equal(apiMatchOf('x.fetch', ['fetch']), 'fetch', '后缀带 `.` 才算')
  assert.equal(matchesApi('can.has', ['can']), true)
  assert.equal(apiMatchOf('anything', []), null)
})

test('同一调用命中多个声明时取**声明顺序里的第一个**（可预期，不随机）', () => {
  assert.equal(
    apiMatchOf('permissions.includes', ['permissions', 'permissions.includes']),
    'permissions',
  )
  assert.equal(
    apiMatchOf('permissions.includes', ['permissions.includes', 'permissions']),
    'permissions.includes',
  )
})
