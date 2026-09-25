import { canonical, dataLayer, reactQueryKit } from '../../es/index.js'

/**
 * 缓存键的**唯一出处**：D22 只认 `queryKeyFrom` 声明的那个文件里的键字面量。
 *
 * - `src/shared/api/queryKeys.ts` 里的 `['crews']` 合规（那就是唯一出处）
 * - `useQuery({ queryKey: ['crews', id] })` 违规（手拼键）
 * - `useQuery({ queryKey: crewsKeys.detail(id) })` 合规（引用唯一出处）
 */
export default {
  presets: [
    canonical(),
    dataLayer(reactQueryKit({ queryKeyFrom: 'src/shared/api/queryKeys.ts' })),
  ],
  overrides: {
    enable: ['D22'],
    ignore: ['arch.config.mjs', 'expect.json'],
  },
}
