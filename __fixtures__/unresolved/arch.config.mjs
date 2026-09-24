import { library } from '../../es/index.js'

// S33 夹具：`./missing` 解析不到 → 这条边在图上不存在，所有图规则都看不见它。
// 同一棵树里 `./b`（存在）与 `node:fs`（外部）都不该报。
export default {
  presets: [library({ modules: { engine: 1, utils: 2 }, entry: [] })],
}
