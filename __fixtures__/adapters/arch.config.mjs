import { canonical, hygiene, uiKit, antdKit } from '../../es/index.js'

// P04 / P05 / P07 夹具：适配表与真实依赖对不上、图标混用、疑似自造轮子
export default {
  presets: [canonical(), hygiene(), uiKit(antdKit())],
  overrides: { ignore: ['arch.config.mjs', 'package.json', 'tsconfig.json', 'expect.json'] },
}
