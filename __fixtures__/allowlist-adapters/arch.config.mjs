import { antdKit, canonical, deps, uiKit } from '../../es/index.js'

/**
 * 回归夹具：`allow` 已显式开启，组件库包只写在适配表里（不在 allow 里重抄）。
 * 注：适配表的 `packages` 是"必须装的那几个"（antd + icons），**不是"整套库的清单"** ——
 * 所以本夹具的 package.json 只装这两个；同套的可选包（如 `@ant-design/x`）装了反而要自己写进 allow。
 *
 * 期望：adapters 的 `packages` 并入批准名单 → antd / @ant-design/icons 不报；
 * 但白名单本身仍然生效（反例见 __fixtures__/deps 的 left-pad）。
 */
export default {
  presets: [canonical(), uiKit(antdKit()), deps({ allow: ['react', 'react-dom'] })],

  overrides: { enable: ['P01'] },
}
