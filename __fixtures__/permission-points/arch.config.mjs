import { canonical, permissions } from '../../es/index.js'

/**
 * 权限点只有一个出处（R-110 / D29）。
 *
 * - 表文件里写字面量 → 合规（那正是表该干的事）
 * - 调用点传常量 `can(PERMISSIONS.crewEdit)` → 合规
 * - 调用点直接写 `can('crew:edit')` → 报（加权限点 / 改名漏一处 = 越权或功能消失）
 */
export default {
  presets: [
    canonical(),
    permissions({ apis: ['can'], source: 'src/shared/auth/permissions.ts' }),
  ],
  overrides: { enable: ['D29'], ignore: ['arch.config.mjs', 'expect.json'] },
}
