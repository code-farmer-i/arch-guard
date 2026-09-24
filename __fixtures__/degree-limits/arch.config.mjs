import { library } from '../../es/index.js'

// S34 夹具：文件级入/出度上限（组粒度看不见的那种失控）。
//   hub/api.ts    被 leaves 下 3 个文件引用 → 入度 3 > 2
//   leaves/a.ts   引用了 3 个项目内文件   → 出度 3 > 2
// 阈值由宿主声明（`structure.degreeLimits`）；没声明这条规则完全不参与判定。
export default {
  presets: [library({ modules: { hub: 1, leaves: 2 }, entry: [] })],
  overrides: {
    structure: {
      degreeLimits: [
        { role: 'lib:hub', maxIn: 2 },
        { role: 'lib:leaves', maxOut: 2 },
      ],
    },
  },
}
