import { canonical } from '../../es/index.js'

// 契约扫描域夹具（S24 违规侧）：`include` 打错一个字母（源码其实在 `src/`），
// 于是域内 0 个文件 —— 所有逐文件规则与角色判定一条都没跑。
// 旧行为是安静地「✔ 通过」；S24 把这种"0 个文件 → 通过"的假绿变成 error。
export default {
  presets: [canonical()],
  overrides: { include: ['app-src/**'] },
}
