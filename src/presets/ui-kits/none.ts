import { defineAdapter } from '../../engine/adapters.js'
import type { UiKitAdapter } from '../../engine/types.js'

/**
 * 「不用组件库」适配器：声明空能力。
 * 于是 vendor / 全局 API / 图标来源相关的规则**不注册**（不会留下空转红线），
 * 组件来源阶梯只剩「shared/components/ui 自研 + 复用」。
 */
export function noneKit(): UiKitAdapter {
  return defineAdapter<UiKitAdapter>('ui-kit', {
    id: 'none',
    specVersion: '1',
    packages: [],
  })
}
