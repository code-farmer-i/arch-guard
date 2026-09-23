import { library } from '../../es/index.js'

// S23 夹具：声明「组维度 slice 必须有公开面」。
// 入口由角色描述符的 entry: true 标记 —— 换范式的入口名（routes.tsx / index.ts）不用改规则。
export default {
  presets: [library({ entry: [] })],
  overrides: {
    roles: [
      { id: 'test', pattern: '**/*.test.{ts,tsx}', layer: 99, exclusive: true },
      { id: 'app', pattern: 'src/app/**', layer: 6 },
      // 入口必须排在前面且互斥：切片根的 index 只命中 entry 角色
      { id: 'pages:index', pattern: 'src/pages/{slice}/index.{ts,tsx}', layer: 5, group: 'slice', entry: true },
      // 切片内的文件都带 segment 维度（顺带覆盖多捕获）
      { id: 'pages', pattern: 'src/pages/{slice}/{segment}/**', layer: 5, group: 'slice' },
      { id: 'features:index', pattern: 'src/features/{slice}/index.{ts,tsx}', layer: 3, group: 'slice', entry: true },
      { id: 'features', pattern: 'src/features/{slice}/{segment}/**', layer: 3, group: 'slice' },
      { id: 'shared', pattern: 'src/shared/**', layer: 1 },
    ],
    structure: { publicApi: ['slice'] },
  },
}
