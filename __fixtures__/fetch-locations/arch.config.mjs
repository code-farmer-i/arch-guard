import { canonical, dataLayer, reactQueryKit } from '../../es/index.js'

/**
 * 场景：页面里直接 useQuery、域里直接 fetch('/api/x')。
 *
 * 声明取数落点（域内 hooks/ 与 shared/api）后：落点外的调用一律报 —— 换数据层不用动页面，
 * 契约类型有唯一的家，测试也不必 mock 网络。测试文件豁免（renderHook 是正常用法）。
 */
export default {
  presets: [
    canonical(),
    dataLayer(
      reactQueryKit({
        fetchIn: ['src/modules/*/hooks/**', 'src/shared/api/**'],
        fetchApis: ['useQuery', 'useMutation', 'fetch'],
      }),
    ),
  ],
  overrides: {
    enable: ['S36'],
    ignore: ['arch.config.mjs', 'expect.json'],
  },
}
