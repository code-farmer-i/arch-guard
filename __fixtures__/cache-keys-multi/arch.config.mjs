import { canonical, dataLayer, reactQueryKit } from '../../es/index.js'

/**
 * 多落点（R-97）：`queryKeyFrom` 收数组，每项可以是 **glob**。
 *
 * - `src/modules/<域>/model/query.ts`（glob）里的键字面量合规（键跟着域走，每个域自己一份）
 * - `src/shared/api/legacy.ts` 里的 `['crews']` 违规（不在任何落点里）
 */
export default {
  presets: [
    canonical(),
    dataLayer(
      reactQueryKit({
        queryKeyFrom: ['src/modules/*/model/query.ts', 'src/shared/api/generated-keys.ts'],
      }),
    ),
  ],
  overrides: { enable: ['D22'], ignore: ['arch.config.mjs', 'expect.json'] },
}
