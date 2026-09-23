import type { Preset, Adapter } from '../engine/types.js'

export { canonical, roleTable, type CanonicalOptions } from './canonical.js'
export {
  designSystem,
  copy,
  deps,
  type DesignSystemOptions,
  type CopyOptions,
  type DepsOptions,
} from './design-system.js'
export { hygiene } from './hygiene.js'
export { antdKit } from './ui-kits/antd.js'
export { noneKit } from './ui-kits/none.js'

/** 把一个适配器包成预设：`uiKit(antdKit())` */
export function uiKit(adapter: Adapter): Preset {
  return { adapters: { [adapter.facet]: adapter } }
}
