import { canonical, sideEffects } from '../../es/index.js'

/**
 * 场景：埋点/上报 SDK 与本地存储读写直接散在各域 —— 隐私判断没地方统一、token 要加密时全仓找、
 * 换 SDK 要翻遍页面。
 *
 * 声明落点（两处封装）后：落点外的调用一律报。测试文件豁免（mock storage 是正常用法）。
 */
export default {
  presets: [
    canonical(),
    sideEffects({
      apis: ['localStorage', 'sessionStorage', 'gtag', 'Sentry.captureException'],
      in: ['src/shared/lib/storage.ts', 'src/shared/lib/analytics.ts'],
    }),
  ],
  overrides: {
    enable: ['S38'],
    ignore: ['arch.config.mjs', 'expect.json'],
  },
}
