import { canonical, hygiene } from '../../es/index.js'

export default {
  presets: [canonical(), hygiene()],
  overrides: {
    // 用极小的阈值来测 S16，避免夹具里堆几百行
    thresholds: { fileLines: 40, viewLines: 20, functionLines: 4, exportsPerFile: 6, componentsPerFile: 3 },
  },
}
