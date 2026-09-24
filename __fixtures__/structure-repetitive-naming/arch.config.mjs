import { library } from '../../es/index.js'

// S30 夹具：同一桶里 > 2 个切片名都带同一个词（`*-widget`）→ 报。
// 用途已经由层表达，组名里再重复一遍只是噪音。
export default {
  presets: [library({ entry: [] })],
  overrides: {
    roles: [
      { id: 'test', pattern: '**/*.test.{ts,tsx}', layer: 99, exclusive: true },
      {
        id: 'features:index',
        pattern: 'src/features/{slice}/index.ts',
        layer: 3,
        group: 'slice',
        entry: true,
      },
      { id: 'features:ui', pattern: 'src/features/{slice}/ui/**', layer: 3, group: 'slice' },
    ],
    structure: { repetitiveNaming: ['slice'] },
  },
}
