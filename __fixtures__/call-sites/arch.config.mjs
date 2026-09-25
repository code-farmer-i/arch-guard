import { callSites, canonical } from '../../es/index.js'

/**
 * 场景（一组一类调用）：
 *
 * - **副作用**：`gtag()` / `Sentry.captureException()` / `localStorage.getItem('token')` 散在各域 ——
 *   隐私判断没地方统一、token 要加密时全仓找、换 SDK 要翻遍页面。
 * - **配置对象**：某个域自己 `new QueryClient()` —— 运行时两个缓存实例，`invalidateQueries` 莫名不生效。
 *
 * 每组建一个封装、声明落点；落点外的调用一律报。测试文件豁免。
 */
export default {
  presets: [
    canonical(),
    callSites([
      {
        name: '副作用',
        apis: ['localStorage', 'sessionStorage', 'gtag', 'Sentry.captureException'],
        in: ['src/shared/lib/storage.ts', 'src/shared/lib/analytics.ts'],
      },
      {
        name: '配置对象',
        apis: ['QueryClient', 'createTheme', 'createStore'],
        in: ['src/app/**', 'src/shared/**'],
      },
    ]),
  ],
  overrides: {
    enable: ['S38'],
    ignore: ['arch.config.mjs', 'expect.json'],
  },
}
