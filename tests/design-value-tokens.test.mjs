import assert from 'node:assert/strict'
import { test } from 'node:test'

import { numericTokens } from '../es/packs/core/rules/design-shared.js'

/**
 * R-150：D12–D14 / D15 / D19 共用的**取值器**。
 *
 * 旧实现是 `split(/\s+/)` + 正则：函数里的值一个都取不到，于是 `calc()` 成了 D12–D14 的逃生门
 * （`padding: calc(100% - 13px)` 一条不报，而 `padding: 13px` 会报）。
 */

const LENGTH = ['px', 'rem', 'em']
const DURATION = ['ms', 's']

test('R-150：函数里也是值 —— calc / min / clamp / var 回退里的数值都要取出来', () => {
  assert.deepEqual(numericTokens('calc(100% - 13px)', LENGTH), ['13px'])
  assert.deepEqual(
    numericTokens('calc(100% - 8px)', LENGTH),
    ['8px'],
    '刻度内的值照取 —— 这是"不误报"的前提',
  )
  assert.deepEqual(numericTokens('min(100%, 320px)', LENGTH), ['320px'])
  assert.deepEqual(
    numericTokens('clamp(1rem, 2vw, 3rem)', LENGTH),
    ['1rem', '3rem'],
    '2vw 不属于这一族，跳过',
  )
  assert.deepEqual(numericTokens('var(--gap, 13px)', LENGTH), ['13px'])
  assert.deepEqual(numericTokens('calc(100% - var(--gap, 13px))', LENGTH), ['13px'])
})

test('R-150：单位大小写不敏感 + 数值归一化（白名单按"值"写，不按拼写）', () => {
  assert.deepEqual(numericTokens('13PX', LENGTH), ['13px'])
  assert.deepEqual(numericTokens('+13px', LENGTH), ['13px'])
  assert.deepEqual(numericTokens('2.0rem', LENGTH), ['2rem'])
  assert.deepEqual(numericTokens('150MS', DURATION), ['150ms'])
  assert.deepEqual(numericTokens('0.0s', DURATION), ['0'], '零归一成 `0`，调用方按"零到处都在"放过')
  assert.deepEqual(numericTokens('0px', LENGTH), ['0'])
  assert.deepEqual(numericTokens('13px/4px', LENGTH), ['13px', '4px'], 'font 简写的斜杠是分隔符')
})

test('R-150：三类不该误吃的', () => {
  assert.deepEqual(numericTokens('line-height 1.5', LENGTH), [], '无单位倍数是正常写法')
  assert.deepEqual(numericTokens('1.5', LENGTH), [])
  assert.deepEqual(numericTokens('cubic-bezier(0.4, 0, 0.2, 1)', DURATION), [], '缓动参数不是时长')
  assert.deepEqual(numericTokens('url(13px)', LENGTH), [], 'url(...) 里是地址不是数值')
  assert.deepEqual(numericTokens('"13px"', LENGTH), [], '字符串不是数值')
  assert.deepEqual(numericTokens('2vw', LENGTH), [], '不属于这一族的单位不取')
})

test('R-150：无单位族（z-index）只认整数，同样归一化', () => {
  assert.deepEqual(numericTokens('9999', []), ['9999'])
  assert.deepEqual(numericTokens('+10', []), ['10'])
  assert.deepEqual(numericTokens('0', []), ['0'])
  assert.deepEqual(numericTokens('-0', []), ['0'])
  assert.deepEqual(numericTokens('1.5', []), [], 'z-index 是整数')
  assert.deepEqual(numericTokens('calc(1 + 999)', []), ['1', '999'])
})
