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
  const adapter = defineAdapter('i18n', {
    id: 'i18next',
    specVersion: '1',
    from: ['i18next', 'react-i18next'],
    hook: options.hook ?? 'useTranslation',
    fn: options.fn ?? 't',
    resourceDir: options.resourceDir ?? 'src/shared/i18n/locales',
    languages: options.languages ?? [],
  })
  return { enable: ['C02', 'C03', 'C04', 'C05', 'C06', 'C07'], adapters: { i18n: adapter } }
}
