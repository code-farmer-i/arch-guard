import { canonical } from '../../es/index.js'

/**
 * 域的公开面入口叫 `routes.ts`（不是 `routes.tsx`）。
 *
 * 角色表本来就认 `routes.{ts,tsx}`，而 S03 / S04 / S05 / S15 以前把 `routes.tsx` 写死在规则里 ——
 * 于是一个入口叫 `routes.ts` 的域会被误报「跨域引用了内部文件」、view「没被 routes 引用」。
 * 这个夹具把那个假阳性钉死：只有域根散件（S03）该报。
 */
export default {
  presets: [canonical()],
  overrides: {
    enable: ['S03', 'S04', 'S05', 'S14', 'S15'],
    ignore: ['arch.config.mjs', 'expect.json'],
  },
}
