import { canonical } from '../../es/index.js'

/**
 * 域的业务公开面（R-98）：`modules/<域>/index.ts` 是**声明出来的公开面入口**（角色带了 `entry: true`），
 * 与 `routes.tsx` 同级 —— 域想对外提供实体/工具就走它。
 *
 * - `billing` 经 `@/modules/crews`（公开面）取用 → 合规
 * - `billing` 直捣 `@/modules/crews/lib/format`（内部文件）→ S04 + S05 报
 */
export default {
  presets: [canonical()],
  overrides: {
    enable: ['S04', 'S05'],
    structure: { publicApi: ['domain'], segmentedGroups: ['domain'] },
    ignore: ['arch.config.mjs', 'expect.json'],
  },
}
