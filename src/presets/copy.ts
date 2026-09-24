import { defineAdapter } from '../engine/adapters.js'
import type { Preset } from '../engine/types.js'

export interface CopyOptions {
  /** 资源目录：`<resourceDir>/<lang>/<namespace>.ts` */
  resourceDir?: string
  /** 语言集；留空则按目录自动发现 */
  languages?: string[]
  /** 翻译函数的调用名（默认 t） */
  fn?: string
  /** 翻译 hook 名（默认 useTranslation） */
  hook?: string
}

/**
 * 文案预设：以 **i18n 适配器**声明能力（适配器是数据，不是插件）。
 * 没声明它，C 域规则会以「能力未声明」出现在 skipped 里，而不是静默失能。
 */
export function copy(options: CopyOptions = {}): Preset {
  // `resourceDir` **不写死**：落点由范式声明（canonical/fsd 的 `params.i18nDir`），
  // 只有项目要改才显式传 `resourceDir`。而"有哪些语言"是**项目事实**，必须显式给。
  const adapter = defineAdapter('i18n', {
    id: 'i18next',
    specVersion: '1',
    from: ['i18next', 'react-i18next'],
    hook: options.hook ?? 'useTranslation',
    fn: options.fn ?? 't',
    languages: options.languages ?? [],
    // 落点：**只有显式给了才写**（否则由范式的 `params.i18nDir` 在 loadConfig 补齐）
    ...(options.resourceDir ? { resourceDir: options.resourceDir } : {}),
  })
  return { enable: ['C02', 'C03', 'C04', 'C05', 'C06', 'C07'], adapters: { i18n: adapter } }
}
