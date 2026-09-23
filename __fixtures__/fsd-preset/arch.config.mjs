import { fsd } from '../../es/index.js'

// fsd() 预设：六层 + 切片维度 + 片段封闭枚举 + 公开面，全部是**声明**；
// 判定全落在通用规则上（S21 层序 / S22 组隔离 / S23 公开面 / S01 封闭枚举）。
export default {
  presets: [fsd()],
}
