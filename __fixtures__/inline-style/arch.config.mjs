import { canonical, designSystem } from '../../es/index.js'

/**
 * 场景：`<div style={{ color: '#ff5a1f', margin: 13, zIndex: 9999 }}>` —— 同一个值写进
 * `.module.css` 会报（D01 / D12–D14），写进内联 `style` 以前**一条都不报**（换个写法绕过整套令牌）。
 * 合规侧：`var(--brand)`、白名单里的 `8px`、`lineHeight: 1.5`、非 style 对象里的颜色都不报。
 */
export default {
  presets: [
    canonical(),
    designSystem({
      styleDir: 'src/shared/styles',
      valueWhitelists: [
        { rule: 'D12', allow: ['8px', '16px'] },
        { rule: 'D13', allow: ['1', '10'] },
        { rule: 'D14', allow: ['150ms'] },
      ],
    }),
  ],
  overrides: { enable: ['D15'], ignore: ['arch.config.mjs', 'expect.json'] },
}
