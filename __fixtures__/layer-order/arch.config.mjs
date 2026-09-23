import { library } from '../../es/index.js'

// S21 夹具：层号不是装饰 —— low(1) 引用 high(2) 是**向上依赖**，必须报。
// 反过来写（low:2, high:1）就是合法的向下依赖，不报。
export default {
  presets: [library({ modules: { low: 1, high: 2 }, entry: [] })],
}
