import assert from 'node:assert/strict'
import { test } from 'node:test'

import { classifyWord, toPlural, toSingular } from '../es/data/plural-forms.js'

test('词形：规则后缀 / 不规则 / 中性词', () => {
  assert.equal(classifyWord('users'), 'plural')
  assert.equal(classifyWord('user'), 'singular')
  assert.equal(classifyWord('notifications'), 'plural')
  assert.equal(classifyWord('notification'), 'singular')
  assert.equal(classifyWord('categories'), 'plural')
  assert.equal(classifyWord('category'), 'singular')
  assert.equal(classifyWord('boxes'), 'plural')
  assert.equal(classifyWord('dishes'), 'plural')
  assert.equal(classifyWord('children'), 'plural')
  assert.equal(classifyWord('child'), 'singular')
  assert.equal(classifyWord('people'), 'plural')
  // 以 -ss / -us / -is 结尾的不是复数（否则 status / analysis / class 全变复数）
  assert.equal(classifyWord('status'), 'singular')
  assert.equal(classifyWord('analysis'), 'singular')
  assert.equal(classifyWord('address'), 'singular')
  assert.equal(classifyWord('class'), 'singular')
  // 中性词：天然不分单复数
  assert.equal(classifyWord('k8s'), 'neutral')
  assert.equal(classifyWord('KUBERNETES'), 'neutral')
  assert.equal(classifyWord('media'), 'neutral')
  // 宿主可以加自己的中性词
  assert.equal(classifyWord('news', ['news']), 'neutral')
})

test('词形：单复互换（用于给出"改成什么"）', () => {
  assert.equal(toPlural('user'), 'users')
  assert.equal(toPlural('category'), 'categories')
  assert.equal(toPlural('box'), 'boxes')
  assert.equal(toPlural('child'), 'children')
  assert.equal(toSingular('users'), 'user')
  assert.equal(toSingular('categories'), 'category')
  assert.equal(toSingular('children'), 'child')
  assert.equal(toSingular('status'), 'status')
})

test('词形（回归）：改用 pluralize 之后，手写表当初判错/分歧的词被钉住', () => {
  // 手写表曾把单数当复数 → 会和别的单数名一起误报「混用」
  assert.equal(classifyWord('alias'), 'singular')
  assert.equal(classifyWord('atlas'), 'singular')
  assert.equal(toSingular('alias'), 'alias', '不能削成 alia')
  // 手写表的 `-is` 守卫曾吞掉短复数 → 漏报
  assert.equal(classifyWord('apis'), 'plural')
  assert.equal(toSingular('apis'), 'api')
  // 不可数词：pluralize 当作复数（与社区 linter 同源）；想让它不参与判定就进中性词表
  assert.equal(classifyWord('software'), 'plural')
  assert.equal(toPlural('software'), 'software')
  assert.equal(classifyWord('software', ['software']), 'neutral')
  // 中性词政策在库之上：media 在 pluralize 眼里是复数，我们仍然中性化
  assert.equal(classifyWord('media'), 'neutral')
  assert.equal(toPlural('media'), 'media')
})
