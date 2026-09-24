import { canonical, copy, i18n, i18nextKit } from '../../es/index.js'

// C07 夹具（第二个分支）：**声明了**要支持的语言，就必须真有资源 ——
// `languages` 以前没人读（语言集合是从磁盘扫出来的），所以"声明了 en 却没有 en/"完全无声。
export default {
  presets: [canonical(), copy(),
    i18n(i18nextKit({ languages: ['zh-CN', 'en'] }))],
  overrides: { enable: ['C07'], ignore: ['arch.config.mjs', 'expect.json'] },
}
