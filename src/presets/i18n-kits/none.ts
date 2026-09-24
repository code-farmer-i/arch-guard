import { defineAdapter } from '../../engine/adapters.js'
import type { I18nAdapter } from '../../engine/types.js'

/**
 * 「不用 i18n」适配器：声明空能力。
 * 于是 C 域规则**不注册**（不会留下空转红线），与"干脆不加 `copy()`"等价，但语义写在配置里。
 */
export function noneI18nKit(): I18nAdapter {
  return defineAdapter<I18nAdapter>('i18n', { id: 'none', specVersion: '1', languages: [] })
}
