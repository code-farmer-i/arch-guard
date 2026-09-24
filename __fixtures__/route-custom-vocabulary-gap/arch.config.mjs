import { canonical, reactRouterKit, router } from '../../es/index.js'

/**
 * **只改 kit、不改角色表**会怎样：S03 明确说清"角色表没跟上"。
 *
 * 没有角色的文件**不进解析**（`collectSources` 只解析命中角色的文件）—— 于是入口的 import
 * 在图上不存在。与其让 S15③ 报"view 没人引用"、S04/S05 看不到入口侧的跨域引用（一堆莫名其妙的错），
 * 不如在 S03 这里报一句能照着改的话：给域入口在角色表里一个角色。
 *
 * 修好角色表后的样子见夹具 `route-custom-vocabulary`。
 */
export default {
  presets: [canonical(), router(reactRouterKit({ routeFiles: ['entry.ts'] }))],
  overrides: {
    enable: ['S03'],
    ignore: ['arch.config.mjs', 'expect.json'],
  },
}
