import { canonical, hygiene } from '../../es/index.js'

// S20 夹具：项目里混进了 react pack 量不了的源码（.vue）。
// 这些文件会被 walk 丢掉，于是「量不了」本来是「0 个文件 → ✔ 通过」的假绿 —— S20 把它变成报错。
export default {
  presets: [canonical(), hygiene()],
}
