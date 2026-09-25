import { canonical } from '../../es/index.js'

/**
 * 场景：`stores/crews.ts` 导出 `useCrewsStore`（合规），另一个域把 `useOrdersStore` 写在 `hooks/` 里（违规）。
 * 声明"状态单元的命名 + 落点"后，后者报 —— 落点内的定义不受影响，消费方（调用它）也不受影响。
 */
export default {
  presets: [canonical()],
  overrides: {
    enable: ['S41'],
    structure: {
      clientState: [{ naming: 'use*Store', in: ['src/modules/*/stores/**', 'src/shared/stores/**'] }],
    },
    ignore: ['arch.config.mjs', 'expect.json'],
  },
}
