import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  colorKey,
  contrastRatio,
  findColorLiterals,
  flatten,
  maskCssComments,
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

test('css：颜色字面量与色值身份（colorKey）', () => {
  const hits = findColorLiterals(
    '.a { color: #FFF; background: rgb(1,2,3); border: 1px solid }\n.b { color: oklch(0.7 0.1 20) }',
  )
  assert.equal(hits.length, 2)
  assert.equal(hits[0]?.line, 1)
  // 色值身份 = 解析成 sRGB 之后的颜色，不是 hex 的拼写（R-153）
  assert.equal(colorKey('#FFF'), 'ffffff')
  assert.equal(colorKey('  #A1B2C3  '), 'a1b2c3')
  assert.equal(colorKey('rgb(255, 90, 31)'), 'ff5a1f', '同一个颜色的两种拼写要算同一个色值')
  assert.equal(colorKey('#ff5a1f'), 'ff5a1f')
  assert.equal(colorKey('rebeccapurple'), '663399')
  assert.equal(colorKey('#00000080'), '00000080', '带 alpha 的色值另有身份（不能和不透明的合并）')
  assert.equal(colorKey('var(--x)'), null, 'D03 只认直接写下的色值：var() 别名是官方推荐的共用方式')
  assert.equal(colorKey('color-mix(in srgb, #fff 50%, #000)'), null, '混色不是"写下来的那个色值"')
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
  assert.ok(Math.abs((resolveColor(vars, '--mix')?.alpha ?? 0) - 0.2) < 1e-12)
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
  const mixTransparent = resolveColor(vars, '--mix-transparent')
  assert.deepEqual(mixTransparent?.rgb, [255, 255, 255])
  // alpha 由 culori 插值算出（0.2 → 0.19999999999999996）：按容差比，别钉浮点字面量
  assert.ok(Math.abs((mixTransparent?.alpha ?? 0) - 0.4) < 1e-12)

  // 解析不了的：返回 null（让规则跳过），**不是** NaN 颜色
  assert.equal(resolveColor(vars, '--five'), null)
  assert.equal(resolveColor(vars, '--not-hex'), null)
  assert.equal(resolveColor(vars, '--bare-word'), null, '不带 # 的单词不能被当成 hex')
  // 带 alpha 的两色混合：R-148 当时"不猜"（返回 null），R-153 起按 CSS 的 premultiplied alpha 真算。
  // `#fff 50% + #00000080 50%`：预乘 c=0.5、a=0.75098 → 反预乘 0.6658 → 170（不是 [128,128,128]）
  const bothAlpha = resolveColor(vars, '--mix-both-alpha')
  assert.deepEqual(bothAlpha?.rgb, [170, 170, 170])
  assert.ok(Math.abs((bothAlpha?.alpha ?? 0) - 0.7509803921568627) < 1e-12)
  // `#0008 50% + #ffffff 50%`：预乘 c=0.5、a=0.76667 → 反预乘 0.6522 → 166
  const oneAlpha = resolveColor(vars, '--mix-alpha')
  assert.deepEqual(oneAlpha?.rgb, [166, 166, 166])
  assert.ok(Math.abs((oneAlpha?.alpha ?? 0) - 0.7666666666666666) < 1e-12)

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

test('R-153：色彩词法交给 culori —— rgb / hsl / 具名色 / oklch 的令牌不再"消失"', () => {
  const vars = new Map([
    ['--rgb', 'rgb(255, 90, 31)'],
    ['--hsl', 'hsl(20 100% 56%)'],
    ['--named', 'rebeccapurple'],
    ['--oklch', 'oklch(0.7 0.15 40)'],
    ['--p3', 'color(display-p3 1 0 0)'],
    ['--junk', 'currentColor'],
  ])
  // 旧实现只认 hex：上面这些一律 null → D07 里"声明过的对比度对"直接不算（静默少判）
  assert.deepEqual(resolveColor(vars, '--rgb')?.rgb, [255, 90, 31])
  assert.deepEqual(resolveColor(vars, '--named')?.rgb, [102, 51, 153])
  assert.equal(resolveColor(vars, '--hsl')?.rgb[1], 105)
  assert.ok((resolveColor(vars, '--oklch')?.rgb[0] ?? 0) > 0)
  // 超色域：按渲染器那样裁剪到 [0,255]，而不是返回 null（返回 null 等于这一对彻底不判）
  assert.deepEqual(resolveColor(vars, '--p3')?.rgb, [255, 0, 0], 'display-p3 红裁到 sRGB 红')
  assert.equal(resolveColor(vars, '--junk'), null, '真的解析不了才返回 null')
})

test('R-153：color-mix 按 CSS 的 premultiplied alpha 算（两个带 alpha 的色不再跳过）', () => {
  const vars = new Map([
    ['--both-alpha', 'color-mix(in srgb, #00000080 50%, #ffffff40)'],
    ['--rgb-mix', 'color-mix(in srgb, rgb(255, 0, 0) 30%, hsl(240 100% 50%))'],
    ['--transparent', 'color-mix(in srgb, #ffffff 20%, transparent)'],
  ])
  // 手算：预乘 (0,0,0,0.50196) 与 (1,1,1,0.25098) 各半 → c=0.12549 a=0.37647 → 反预乘 0.33333 → 85
  const mixed = resolveColor(vars, '--both-alpha')
  assert.deepEqual(mixed?.rgb, [85, 85, 85], 'premultiplied：不是 [128,128,128]')
  assert.ok(Math.abs((mixed?.alpha ?? 0) - 0.3764705882352941) < 1e-12)
  assert.deepEqual(resolveColor(vars, '--rgb-mix')?.rgb, [77, 0, 179], '操作数可以是任意 CSS 颜色')
  assert.ok(
    Math.abs((resolveColor(vars, '--transparent')?.alpha ?? 0) - 0.2) < 1e-12,
    '与 transparent 混 = alpha 乘权重',
  )
})

test('R-153：WCAG 对比度换成 culori 的 wcagContrast —— 与手搓那份逐位一致', () => {
  /** 参照实现：换库前 `engine/css.ts` 里那份（WCAG 2.x 相对亮度 + 0.03928 阈值） */
  const reference = ([r, g, b], [r2, g2, b2]) => {
    const channel = (v) => {
      const c = v / 255
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    }
    const lum = ([rr, gg, bb]) => 0.2126 * channel(rr) + 0.7152 * channel(gg) + 0.0722 * channel(bb)
    const [hi, lo] = [lum([r, g, b]), lum([r2, g2, b2])].sort((x, y) => y - x)
    return (hi + 0.05) / (lo + 0.05)
  }
  // 网格采样：覆盖 0 通道、阈值附近的通道值（10 / 11）、中间灰与极值
  const channelValues = [0, 1, 10, 11, 12, 128, 200, 254, 255]
  let checked = 0
  for (const r of channelValues)
    for (const g of channelValues)
      for (const b of channelValues) {
        const a = [r, g, b]
        const c = [255 - r, 255 - g, 255 - b]
        assert.ok(
          Math.abs(contrastRatio(a, c) - reference(a, c)) < 1e-12,
          `与手搓那份不一致：${a} vs ${c}`,
        )
        checked += 1
      }
  assert.ok(checked >= 700, `采样数 ${checked}`)
  assert.equal(contrastRatio([0, 0, 0], [255, 255, 255]), 21, '黑白仍是 21:1')
  assert.equal(contrastRatio([10, 10, 10], [10, 10, 10]), 1)
})
