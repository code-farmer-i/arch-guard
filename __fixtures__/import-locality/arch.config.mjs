import { library } from '../../es/index.js'

// S32 夹具（与社区 linter 一样默认关，这里显式打开）：
//   同组内必须相对导入、跨组必须走别名。
//   pages/crews/ui/CrewsPage.tsx  跨组用相对路径 → 报
//   entities/crew/ui/CrewCard.tsx 同组用别名     → 报
//   合规：同组相对（`./Helper`）、跨组别名（`@/entities/crew`）
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
      {
        id: 'features:index',
        pattern: 'src/features/{slice}/index.ts',
        layer: 3,
        group: 'slice',
        entry: true,
      },
      { id: 'features:ui', pattern: 'src/features/{slice}/ui/**', layer: 3, group: 'slice' },
      {
        id: 'entities:index',
        pattern: 'src/entities/{slice}/index.ts',
        layer: 2,
        group: 'slice',
        entry: true,
      },
      { id: 'entities:ui', pattern: 'src/entities/{slice}/ui/**', layer: 2, group: 'slice' },
    ],
    structure: { importLocality: ['slice'] },
  },
}
