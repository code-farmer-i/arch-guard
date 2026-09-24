import { defineAdapter } from '../../engine/adapters.js'
import type { I18nAdapter } from '../../engine/types.js'

export interface I18nextKitOptions {
  /** 资源目录：`<resourceDir>/<lang>/<namespace>.ts`。不传则由范式的 `params.i18nDir` 补 */
  resourceDir?: string
  /** 项目声明要支持的语言；与磁盘实况对账（C07） */
  languages?: string[]
  /** 翻译函数名（默认 `t`） */
  fn?: string
  /** 翻译 hook 名（默认 `useTranslation`） */
  hook?: string
}

/**
 * i18next / react-i18next 适配器。**库名只许出现在这里**（`presets/i18n-kits/`，与 `ui-kits/` 对称）——
 * 以前它硬编码在通用预设 `copy()` 里：`--verify-deps` 会拿 `from` 去对账 package.json，
 * 于是"项目换了 i18n 方案却还留着 copy()"会误报"声明了 i18next 却没装"。
 */
export function i18nextKit(options: I18nextKitOptions = {}): I18nAdapter {
  return defineAdapter<I18nAdapter>('i18n', {
    id: 'i18next',
    specVersion: '1',
    from: ['i18next', 'react-i18next'],
    hook: options.hook ?? 'useTranslation',
    fn: options.fn ?? 't',
    languages: options.languages ?? [],
    ...(options.resourceDir ? { resourceDir: options.resourceDir } : {}),
  })
}
