import { library } from '../../es/index.js'

// S26 / S27 夹具：两条规模阈值都由**宿主动声明**（预设不给默认值）。
//   S26 同一层同一桶里 3 个切片 > 上限 2
//   S27 `src/parts` 有 2 个一级子目录 > 上限 1
export default {
  presets: [library({ entry: [] })],
  overrides: {
    roles: [
      { id: 'test', pattern: '**/*.test.{ts,tsx}', layer: 99, exclusive: true },
      {
        id: 'pages:index',
        pattern: 'src/pages/{slice}/index.ts',
        layer: 5,
        group: 'slice',
        entry: true,
      },
      { id: 'pages:ui', pattern: 'src/pages/{slice}/ui/**', layer: 5, group: 'slice' },
      { id: 'parts', pattern: 'src/parts/**', layer: 1 },
    ],
    structure: {
      groupCountLimits: [{ dimension: 'slice', max: 2 }],
      directoryItemLimits: [{ role: 'parts', max: 1 }],
    },
  },
}
