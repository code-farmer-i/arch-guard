import { library } from '../../es/index.js'

// S29 夹具：切片名撞上**真实存在**的单元名。
//   `shared/config` 存在 → `pages/config` 这个切片名与之撞车 → 报
//   `shared/absent` 只写在词汇表里、项目里并不存在 → 不算（词表按真实目录过滤）
export default {
  presets: [library({ entry: [] })],
  overrides: {
    roles: [
      { id: 'test', pattern: '**/*.test.{ts,tsx}', layer: 99, exclusive: true },
      { id: 'shared:config', pattern: 'src/shared/config/**', layer: 1 },
      // 存在的角色、但没有目录命中它 → 不进词汇表（这正是本夹具原本要验的宽容性）
      { id: 'shared:unused', pattern: 'src/shared/unused/**', layer: 1 },
      {
        id: 'pages:index',
        pattern: 'src/pages/{slice}/index.ts',
        layer: 5,
        group: 'slice',
        entry: true,
      },
      { id: 'pages:ui', pattern: 'src/pages/{slice}/ui/**', layer: 5, group: 'slice' },
    ],
    structure: {
      nameCollisions: [
        { dimension: 'slice', vocabularyRoles: ['shared:config', 'shared:unused'] },
      ],
    },
  },
}
