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

/* ---------------- R-145：手搓扫描器会**静默错解**的输入（换成 postcss 的验收） ---------------- */

test('css：值里的 ; 与 } 不再截断声明（旧扫描器会丢掉整条 background）', () => {
  const model = parseCss(
    'src/a.module.css',
    ['.b {', '  content: ";";', '  background: url(data:image/svg+xml;base64,AAA=);', '}'].join(
      '\n',
    ),
  )
  assert.equal(model.rules.length, 1)
  assert.deepEqual(
    model.rules[0]?.declarations.map((item) => item.prop),
    ['content', 'background'],
  )
  assert.equal(model.rules[0]?.declarations[1]?.value, 'url(data:image/svg+xml;base64,AAA=)')
  assert.equal(model.rules[0]?.declarations[1]?.line, 3)
})

test('css：at-rule 不是选择器，但 @page 这类声明仍进规则模型（D12–D14 / D19 的判定面不缩水）', () => {
  const model = parseCss(
    'src/global.css',
    [
      '@media (min-width: 600px) {',
      '  .card { margin: var(--gap , 8px); }',
      '}',
      '@page { margin: 13px; }',
    ].join('\n'),
  )
  // 选择器只有真选择器：at-rule 前奏（`@media (…)`）不再污染 D10 / D10b / P11 的判定面
  assert.deepEqual(
    model.selectors.map((item) => item.selector),
    ['.card'],
  )
  assert.deepEqual(
    model.rules.map((item) => item.selector),
    ['.card', '@page'],
  )
  const page = model.rules.find((item) => item.selector === '@page')
  assert.deepEqual(
    page?.declarations.map((item) => [item.prop, item.value]),
    [['margin', '13px']],
  )
  // 带空白的 fallback 也算 fallback（`var(--gap , 8px)`）
  assert.deepEqual(
    model.varRefs.map((item) => [item.name, item.hasFallback]),
    [['--gap', true]],
  )
})

test('css：!important 留在声明值里（D09 是拿 value 正则判的）', () => {
  const model = parseCss('src/a.module.css', '.a { color: red !important; }')
  assert.equal(model.rules[0]?.declarations[0]?.value, 'red !important')
})

test('css：按扩展名选语法 —— .scss（// 注释 + #{} 插值）与 .less（@{} 插值）', () => {
  const scss = parseCss(
    'src/a.module.scss',
    ['// 注释', '.icon-#{$name} {', '  color: $c;', '}'].join('\n'),
  )
  assert.deepEqual(
    scss.selectors.map((item) => item.selector),
    ['.icon-#{$name}'],
  )
  assert.equal(scss.comments.length, 1)

  const less = parseCss('src/b.module.less', '.icon-@{name} { color: @c; }')
  assert.deepEqual(
    less.selectors.map((item) => item.selector),
    ['.icon-@{name}'],
  )
})

test('css：坏语法 fail-closed（抛错并带 文件:行:列），不静默错解', () => {
  assert.throws(
    () => parseCss('src/broken.css', '.a { color: red'),
    /CSS 解析失败：src\/broken\.css:1:1/,
  )
  assert.throws(() => parseCss('src/broken.css', '.a {}}\n'), /CSS 解析失败：src\/broken\.css:1:6/)
})

test('css：4/8 位 hex 带 alpha，且任何输入都不产 NaN（R-148）', () => {
  const vars = new Map([
    ['--rgba', '#0008'],
    ['--rrggbbaa', '#00000080'],
    ['--mix-alpha', 'color-mix(in srgb, #0008 50%, #ffffff)'],
    ['--mix-transparent', 'color-mix(in srgb, #ffffff 40%, transparent)'],
    ['--five', '#12345'],
    ['--not-hex', '#zzzzzz'],
    ['--mix-both-alpha', 'color-mix(in srgb, #fff 50%, #00000080)'],
    ['--bare-word', 'abcdef'],
  ])

  // `#RGBA`：alpha 也要展开（8 → 88 = 136/255）
  const rgba = resolveColor(vars, '--rgba')
  assert.deepEqual(rgba?.rgb, [0, 0, 0])
  assert.ok(Math.abs((rgba?.alpha ?? 0) - 136 / 255) < 1e-9)
  // `#RRGGBBAA`：alpha 不再被当成 rgb 的一部分
  assert.ok(Math.abs((resolveColor(vars, '--rrggbbaa')?.alpha ?? 0) - 128 / 255) < 1e-9)
  // 与 transparent 混 = alpha 乘权重
  assert.deepEqual(resolveColor(vars, '--mix-transparent'), {
    rgb: [255, 255, 255],
    alpha: 0.4,
  })

  // 解析不了的：返回 null（让规则跳过），**不是** NaN 颜色
  assert.equal(resolveColor(vars, '--five'), null)
  assert.equal(resolveColor(vars, '--not-hex'), null)
  assert.equal(resolveColor(vars, '--bare-word'), null, '不带 # 的单词不能被当成 hex')
  assert.equal(resolveColor(vars, '--mix-alpha'), null, '带 alpha 的两色混合不猜（premultiplied）')
  assert.equal(resolveColor(vars, '--mix-both-alpha'), null)

  // 回归断言：**任何**解析得出来的颜色都不许含 NaN（旧实现在 #0008 上给 [0, 8, NaN]）
  for (const name of vars.keys()) {
    const color = resolveColor(vars, name)
    if (!color) continue
    assert.deepEqual(
      [...color.rgb, color.alpha].every((value) => Number.isFinite(value)),
      true,
      `${name} 产出了非有限值：${JSON.stringify(color)}`,
    )
  }
})
