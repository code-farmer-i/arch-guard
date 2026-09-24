import { library } from '../../es/index.js'

// S28 夹具：跨层引用组数少于下限即报（0 个 = 死切片）。
//   features/dead      零引用 → 报
//   features/apponly   只被 app（第 6 层）引用 → 放过（singleFromLayers）
//   pages/*            整层跳过（页面天然只被装配层引用）
export default {
  presets: [library({ entry: [] })],
  overrides: {
    roles: [
      { id: 'test', pattern: '**/*.test.{ts,tsx}', layer: 99, exclusive: true },
      { id: 'app', pattern: 'src/app/**', layer: 6 },
      {
        id: 'pages:index',
        pattern: 'src/pages/{slice}/index.ts',
        layer: 5,
        group: 'slice',
        entry: true,
      },
      { id: 'pages:ui', pattern: 'src/pages/{slice}/ui/**', layer: 5, group: 'slice' },
      {
        id: 'features:index',
        pattern: 'src/features/{slice}/index.ts',
        layer: 3,
        group: 'slice',
        entry: true,
      },
      { id: 'features:ui', pattern: 'src/features/{slice}/ui/**', layer: 3, group: 'slice' },
    ],
    structure: {
      groupInDegree: [
        { dimension: 'slice', min: 1, exceptLayers: [5], singleFromLayers: [6] },
      ],
    },
  },
}
