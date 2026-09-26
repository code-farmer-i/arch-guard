import { canonical, copy, designSystem } from '../../es/index.js'

/**
 * 对比度组合必须声明过（R-102 / D27）。
 *
 * 声明的是"必然通过"的那一对（正文）；组件里却把语义令牌当反色用
 * （`color: var(--surface)` + `background: var(--brand)`）→ 这一对没人算，D27 报出来。
 */
export default {
  presets: [
    canonical(),
    copy(),
    designSystem({
      contrastPairs: [{ fg: '--text-primary', bg: '--surface', usage: '正文', min: 4.5 }],
    }),
  ],
  overrides: { enable: ['D27'], ignore: ['arch.config.mjs', 'expect.json'] },
}
