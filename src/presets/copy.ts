import type { Preset } from '../engine/types.js'

/**
 * 文案（copy）域：**只贡献 C 域规则集**（C02–C07）。
 *
 * i18n 适配器来自 `i18n(i18nextKit())` / `i18n(noneI18nKit())` —— 与 `uiKit(adapter)` 同形。
 * 以前这里内联了一份 i18next 适配器（`from: ['i18next','react-i18next']`），后果是：
 * ① 通用预设里出现库名（P4 自检会拦）；② `--verify-deps` 拿它对账 package.json，
 * 项目换了 i18n 方案却还留着 `copy()` 就误报"声明了 i18next 却没装"。
 *
 * 不注册适配器时，C 域规则会以「因能力未声明而停用」明列 —— 不是静默失能。
 */
export interface CopyOptions {
  /**
   * 「组件库调用里的文案」的 API 名单（C01 的另一半）：`['message.success', 'notification.open']`。
   * 传字符串实参的调用会被当成文案位 —— 比如 `message.success('保存')`。
   * **不声明就不判这一半**：各项目用的组件库 / 封装不同，猜一个默认名单必然误伤。
   */
  messageApis?: string[]
}

export function copy(options: CopyOptions = {}): Preset {
  return {
    enable: ['C01', 'C02', 'C03', 'C04', 'C05', 'C06', 'C07'],
    params: { messageApis: options.messageApis ?? [] },
  }
}
