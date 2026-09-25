import { canonical } from '../../es/index.js'

/**
 * 场景（与 C10 同源的数据缺口）：canonical 的 routes.tsx 是域的公开面入口（entry: true）——
 * 声明 publicApi 后：跨域直接引用域内**非入口**文件报；经 routes（入口）引用则不报。
 *
 * 注：S28（外部引用下限）在 canonical 下的口径待核 —— 已合规经入口引用的域也被它报成「没有任何外部引用」，
 * 疑似与 S23 重复报同一根因，故本夹具先只钉 S23。
 */
export default {
  presets: [canonical()],
  overrides: {
    enable: ['S23'],
    structure: {
      publicApi: ['domain'],
    },
    ignore: ['arch.config.mjs', 'expect.json'],
  },
}
