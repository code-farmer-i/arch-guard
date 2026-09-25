import { canonical, hygiene } from '../../es/index.js'

/**
 * 场景：`const api = 'http://localhost:3000/api'` 写进源码 → 跟着构建进生产。
 * 合规侧：外部文档链接不判（避免误伤），测试文件里的 localhost 是 mock 服务（正常用法）。
 */
export default {
  presets: [canonical(), hygiene()],
  overrides: { enable: ['H08'], ignore: ['arch.config.mjs', 'expect.json'] },
}
