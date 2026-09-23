import { canonical, hygiene } from '../../es/index.js'

export default {
  presets: [canonical(), hygiene()],
  overrides: {
    enable: ['S02', 'S12', 'S13', 'S16', 'H01', 'H02', 'H03', 'H04', 'H05'], // 合成夹具只跑它要展示的规则：S15 这类项目形状规则需要完整工程才成立
    // 用极小的阈值来测 S16，避免夹具里堆几百行
    thresholds: { fileLines: 40, viewLines: 20, functionLines: 4, exportsPerFile: 6, componentsPerFile: 3 },
  },
}
