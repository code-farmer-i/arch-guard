import assert from 'node:assert/strict'
import { test } from 'node:test'
import { extractFacts } from '../es/index.js'

const factsOf = (text, rel = 'src/a.ts') => extractFacts({ file: rel, rel, role: 'test', text })

/* ---------------- 事实模型 ---------------- */

test('facts：import 的三种形态（类型 / 动态 / 副作用）', () => {
  const facts = factsOf(`
import type { A } from './a.js'
import './side-effect.css'
const b = await import('./b.js')
`)
  assert.deepEqual(
    facts.imports.map((item) => [item.spec, item.typeOnly, item.dynamic]),
    [
      ['./a.js', true, false],
      ['./side-effect.css', false, false],
      ['./b.js', false, true],
    ],
  )
})

test('facts：导出的各种形态', () => {
  const facts = factsOf(`
export * from './x.js'
export * as ns from './n.js'
export { one } from './o.js'
export default function main() {}
export function named() {}
export const value = 1
export const arrow = () => 1
export interface Shape { a: 1 }
export type Alias = string
`)
  const byName = Object.fromEntries(
    facts.exports.filter((e) => e.declared).map((e) => [e.name, e.kind]),
  )
  assert.equal(byName.main, 'function')
  assert.equal(byName.named, 'function')
  assert.equal(byName.value, 'const')
  assert.equal(byName.arrow, 'arrow')
  assert.equal(byName.Shape, 'interface')
  assert.equal(byName.Alias, 'type')
  assert.ok(
    facts.exports.some((e) => e.isStar),
    'export * 记成 star',
  )
  assert.ok(
    facts.exports.some((e) => e.name === 'ns'),
    'namespace 再导出',
  )
  assert.ok(facts.exports.some((e) => e.name === 'one' && e.kind === 're-export'))
})

test('facts：字符串带上下文与属性名（P06 指纹与文案规则要用）', () => {
  const facts = factsOf(`
const a = { to: '/x', kind: 'k' }
const b = call('arg')
const c = el['key']
`)
  const withProp = facts.strings.find((item) => item.value === '/x')
  assert.equal(withProp?.context, 'property-value')
  assert.equal(withProp?.prop, 'to')
  assert.equal(facts.strings.find((item) => item.value === 'arg')?.context, 'call-arg')
  assert.equal(facts.strings.find((item) => item.value === 'key')?.context, 'element-access')
})

test('facts：debugger 记进 calls、hasJsx 标记（裸文本/any/空 catch 已随委派删除）', () => {
  const facts = factsOf(
    `
export function C(props: any) {
  const a = props.value!
  try { go() } catch { /* 忽略 */ }
  debugger
  return <div>裸文本</div>
}
`,
    'src/c.tsx',
  )
  assert.ok(facts.calls.some((call) => call.callee === 'debugger'))
  assert.equal(facts.hasJsx, true)
})

test('facts：函数体量与组件判定', () => {
  const facts = factsOf(
    `
export function Widget() {
  return <div />
}
export function helper(n: number) {
  return n + 1
}
const arrow = () => 1
`,
    'src/f.tsx',
  )
  const widget = facts.functions.find((fn) => fn.name === 'Widget')
  const helper = facts.functions.find((fn) => fn.name === 'helper')
  assert.equal(widget?.isComponent, true)
  assert.equal(helper?.isComponent, false)
  assert.ok(facts.functions.some((fn) => fn.name === 'arrow'))
  assert.ok((facts.functions.find((fn) => fn.name === 'Widget')?.lines ?? 0) >= 3)
})

test('facts：解析失败要产出行号（fail-closed 判据）', () => {
  const facts = factsOf('export function broken( {\n  return\n')
  assert.ok(facts.parseErrors.length > 0)
  assert.ok(facts.parseErrors.every((error) => error.line >= 1))
})
