import { library } from '../../es/index.js'

// S22 夹具：声明「组维度 slice」—— 同层不同组不许直连；跨层与同组内部都合法
export default {
  presets: [library({ entry: [] })],
  overrides: {
    roles: [
      { id: 'test', pattern: '**/*.test.{ts,tsx}', layer: 99, exclusive: true },
      { id: 'app', pattern: 'src/app/**', layer: 6 },
      { id: 'pages', pattern: 'src/pages/{slice}/**', layer: 5, group: 'slice' },
      { id: 'features', pattern: 'src/features/{slice}/**', layer: 3, group: 'slice' },
      { id: 'shared', pattern: 'src/shared/**', layer: 1 },
    ],
    structure: { isolate: ['slice'] },
  },
}
