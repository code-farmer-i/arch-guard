import { canonical, hygiene } from '../../es/index.js'

// 自定义目录名的回归夹具：`canonical({ modules, shared })` 必须让**角色表与图规则一起**跟着走。
// 曾经的 bug：角色表跟着变了，但 S04–S09 / S15 / S18 还写死查 `${srcRoot}/modules` →
// 查不到就静默空转，这里的跨域引用私有 views 一条都不报（假绿）。
export default {
  presets: [canonical({ modules: 'src/features', shared: 'src/common' }), hygiene()],
}
