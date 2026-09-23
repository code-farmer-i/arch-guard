import { canonical, hygiene } from '../../es/index.js'

// S19（导出宽度 / 单文件组件数）夹具：两条都被违反，且两个文件都接进可达图（避免顺带触发 S15）。
export default {
  presets: [canonical(), hygiene()],
}
