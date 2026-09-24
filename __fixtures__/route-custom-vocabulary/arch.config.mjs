import { canonical, reactRouterKit, router } from '../../es/index.js'

/**
 * **自定义入口词汇**：域的公开面入口叫 `entry.ts`（不是 `routes.*`）。
 *
 * 这是"改 kit + 改角色表"的推荐路径：kit 声明 `routeFiles: ['entry.ts']`，S03 / S04 / S05 / S14 / S15
 * 全部照它判（S14 的"有没有入口"、S15② 的"必须被 app 聚合"都按**词汇**认，不再看角色 slot）；
 * 角色表用 `addRoles` 追加一份 `slot: 'routes'` 的角色，入口才会进解析集（图规则才看得到它的 import）。
 *
 * 只改 kit、不改角色表会怎样：见夹具 `route-custom-vocabulary-gap`（S03 会明确报"角色表没跟上"）。
 */
export default {
  presets: [canonical(), router(reactRouterKit({ routeFiles: ['entry.ts'] }))],
  overrides: {
    addRoles: [
      { id: 'module:entry', pattern: 'src/modules/{domain}/entry.ts', layer: 10, slot: 'routes' },
    ],
    enable: ['S03', 'S04', 'S05', 'S14', 'S15'],
    ignore: ['arch.config.mjs', 'expect.json'],
  },
}
