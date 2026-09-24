import { canonical, hygiene, deps } from '../../es/index.js'

export default {
  presets: [canonical(), hygiene(), deps({ capabilities: { datetime: 'dayjs' } })],

  // P06（强指纹：手搓格式化/取分量/解析）与 P07（弱指纹 + 自研同名）都要覆盖
  overrides: { enable: ['P06', 'P07'] },
}
