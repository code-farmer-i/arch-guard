import { canonical, designSystem } from '../../es/index.js'

/**
 * 场景：`staleTime: 300_000` 写在 hooks 里、`retry: 3` 写在另一处 ——
 * 策略数字散在各处，要统一改口径时全仓搜。声明"这些名字的数字必须有家"后就报。
 * 合规侧：落在声明的家（`src/shared/config/**`）里、以及不在名单里的名字（`timeout`）都不报。
 */
export default {
  presets: [
    canonical(),
    designSystem({
      numberHomes: [
        { name: '请求策略', names: ['staleTime', 'retry'], in: ['src/shared/config/**'] },
      ],
    }),
  ],
  overrides: { enable: ['D20'], ignore: ['arch.config.mjs', 'expect.json'] },
}
