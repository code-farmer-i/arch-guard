import { fsd } from '../../es/index.js'

/**
 * 官方 `@x` 跨引用公开面（R-105）：`<provider>/@x/<consumer>.ts`。
 *
 * - `entities/artist` 从 `entities/song/@x/artist` 取用 → **合规**（那是 song 显式声明给 artist 的）
 * - `entities/order` 也从同一个文件取用 → **S22 报**（只放行被指名的那一侧）
 */
export default {
  presets: [fsd()],
  overrides: {
    enable: ['S01', 'S22', 'S23'],
    ignore: ['arch.config.mjs', 'expect.json'],
  },
}
