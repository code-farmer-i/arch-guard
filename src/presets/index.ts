import type { Preset, Adapter } from '../engine/types.js'

export { canonical, roleTable, type CanonicalOptions } from './canonical.js'
export { library, libraryRoleTable, type LibraryOptions } from './library.js'
export { designSystem, deps, type DesignSystemOptions, type DepsOptions } from './design-system.js'
export { copy, type CopyOptions } from './copy.js'
export { metrics, type CoverageOptions, type MetricsOptions, type PerDirMin } from './metrics.js'
export { hygiene } from './hygiene.js'
export { antdKit } from './ui-kits/antd.js'
export { noneKit } from './ui-kits/none.js'

/** 把一个适配器包成预设：`uiKit(antdKit())` */
export function uiKit(adapter: Adapter): Preset {
  return { adapters: { [adapter.facet]: adapter } }
}
