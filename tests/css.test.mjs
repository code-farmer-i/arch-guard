import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  contrastRatio,
  findColorLiterals,
  flatten,
  maskCssComments,
  normalizeHex,
  parseCss,
  resolveColor,
} from '../es/engine/css.js'

test('css：块、声明、变量定义与引用、注释遮罩', () => {
  const text = [
    '/* 注释里有 #ff0000 与 var(--fake) */',
    ':root {',
    '  --a: #ffffff;',
    '  --b: var(--a);',
    '}',
    '.card {',
    '  color: var(--b);',
    '  margin: var(--missing, 8px);',
    '}',
  ].join('\n')
  const model = parseCss('src/a.css', text)
  assert.equal(model.rules.length, 2)
  assert.deepEqual(
    model.vars.map((item) => [item.name, item.line]),
    [
      ['--a', 3],
      ['--b', 4],
    ],
  )
  // 三条引用：var(--b)、var(--missing, 8px)（带 fallback）、以及 --b 自己的 var(--a)
  assert.equal(model.varRefs.length, 3)
  assert.deepEqual(
    model.varRefs.map((item) => [item.name, item.hasFallback]),
    [
      ['--a', false],
      ['--b', false],
      ['--missing', true],
    ],
  )
  // 注释被遮罩：注释第 1 行的 #ff0000 不算，只有 --a 的 #ffffff 算
  assert.deepEqual(
    findColorLiterals(text).map((hit) => hit.line),
    [3],
  )
  assert.equal(model.comments.length, 1)

  const { masked } = maskCssComments(text)
  assert.ok(masked.split('\n')[1]?.startsWith(':root'), '注释行被替换成空格但保留行数')
  assert.equal(masked.split('\n').length, text.split('\n').length)
})

test('css：颜色字面量与 hex 归一化', () => {
  const hits = findColorLiterals(
    '.a { color: #FFF; background: rgb(1,2,3); border: 1px solid }\n.b { color: oklch(0.7 0.1 20) }',
  )
  assert.equal(hits.length, 2)
  assert.equal(hits[0]?.line, 1)
  assert.equal(normalizeHex('#FFF'), 'ffffff')
  assert.equal(normalizeHex('fff'), 'ffffff')
  assert.equal(normalizeHex('#A1B2C3'), 'a1b2c3')
})

test('css：令牌求值（var 链 / color-mix / 透明 / 无法解析返回 null）', () => {
  const vars = new Map([
    ['--base', '#000000'],
    ['--alias', 'var(--base)'],
    ['--mix', 'color-mix(in srgb, #ffffff 20%, transparent)'],
    ['--mix2', 'color-mix(in srgb, #ffffff 50%, var(--base))'],
    ['--weird', 'var(--alias) /* 不是纯 var */'],
  ])
  assert.deepEqual(resolveColor(vars, '--alias')?.rgb, [0, 0, 0])
  assert.equal(resolveColor(vars, '--mix')?.alpha, 0.2)
  assert.deepEqual(resolveColor(vars, '--mix2')?.rgb, [128, 128, 128])
  assert.equal(resolveColor(vars, '--nope'), null)
  assert.equal(resolveColor(vars, '--weird'), null, '只认 var(--x) 这种纯引用')

  // 半透明压到背景上
  const flat = flatten({ rgb: [255, 255, 255], alpha: 0.5 }, [0, 0, 0])
  assert.deepEqual(flat, [128, 128, 128])
  assert.deepEqual(flatten({ rgb: [1, 2, 3], alpha: 1 }, [9, 9, 9]), [1, 2, 3])

  // 对比度：黑白是 21:1
  assert.equal(Math.round(contrastRatio([0, 0, 0], [255, 255, 255])), 21)
  assert.equal(contrastRatio([0, 0, 0], [0, 0, 0]), 1)
})

test('css：@import 与选择器清单（graph 与 D10 都依赖它）', () => {
  const model = parseCss(
    'src/shared/styles/index.css',
    '@import "./tokens/palette.css";\n.ant-btn, .x { color: var(--a); }',
  )
  assert.deepEqual(
    model.selectors.map((item) => item.selector),
    ['.ant-btn, .x'],
  )
  assert.equal(model.varRefs[0]?.name, '--a')
})
