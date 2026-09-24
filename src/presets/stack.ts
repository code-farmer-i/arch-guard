import type { I18nAdapter, Preset, UiKitAdapter } from '../engine/types.js'

import { copy } from './copy.js'
import { deps, designSystem, type DepsOptions, type DesignSystemOptions } from './design-system.js'
import { hygiene } from './hygiene.js'
import { noneI18nKit } from './i18n-kits/none.js'
import { i18n, uiKit } from './kit.js'
import { metrics, type MetricsOptions } from './metrics.js'
import { noneKit } from './ui-kits/none.js'

export interface StackOptions {
  /** 设计系统落点等（不传则由范式声明，见 `Preset.paradigm`） */
  designSystem?: DesignSystemOptions
  /** 依赖选型：`allow`（fail-closed 白名单）或 `deny` */
  deps?: DepsOptions
  /** 组件库适配器，如 `antdKit()`；默认 `noneKit()`（声明空能力，**不替项目选型**） */
  uiKit?: UiKitAdapter
  /** i18n 适配器，如 `i18nextKit({ languages })`；默认 `noneI18nKit()`（C 域不注册） */
  i18n?: I18nAdapter
  /** 度量：**给了才加**（覆盖率产物路径是项目事实） */
  metrics?: MetricsOptions
  /** 是否加反退化域（默认加；它只设阈值，规则靠能力协商） */
  hygiene?: boolean
}

/**
 * **组合方案**：把各域预设按需装配成一串原子预设，供 `presets: [范式(), ...stack({…})]` 使用。
 *
 * 三条设计约束（这就是"原子化 + 自由组合"的落地形态）：
 * 1. **不含任何硬编码**：不猜组件库、不猜语言、不猜依赖白名单、不写落点 —— 全部由选项传入，
 *    没给就用"声明空能力"的 `noneKit()` / `noneI18nKit()`（对应规则**明列停用**，不是静默失能）。
 * 2. **不引入新语义**：`stack()` 只是把 `designSystem()` / `copy()` / `deps()` / `hygiene()` /
 *    `i18n()` / `uiKit()` / `metrics()` 拼起来；用户完全可以不要它、手写这几行。
 * 3. **一个变量只表达一件事**：范式仍由 `presets` 里那一个范式预设决定（`canonical` / `library` / `fsd`），
 *    `stack()` 只负责正交的域轴。
 *
 * ```js
 * presets: [
 *   canonical(),
 *   ...stack({
 *     i18n: i18nextKit({ languages: ['zh-CN', 'en'] }),
 *     uiKit: antdKit(),
 *     deps: { allow: ['react', 'react-dom', 'antd', 'i18next', 'react-i18next'] },
 *   }),
 * ]
 * ```
 */
export function stack(options: StackOptions = {}): Preset[] {
  return [
    designSystem(options.designSystem ?? {}),
    copy(),
    deps(options.deps ?? {}),
    ...(options.hygiene === false ? [] : [hygiene()]),
    i18n(options.i18n ?? noneI18nKit()),
    uiKit(options.uiKit ?? noneKit()),
    ...(options.metrics ? [metrics(options.metrics)] : []),
  ]
}
