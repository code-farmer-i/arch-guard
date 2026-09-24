import { fsd } from '../../es/index.js'

// S32 夹具：社区 linter 的 import-locality 默认关闭，这里显式打开。
// 同组内必须相对导入、跨组必须走别名 —— 声明才生效，不声明这条规则不参与判定。
export default {
  presets: [fsd()],
  overrides: {
    structure: { importLocality: ['slice'] },
  },
}
