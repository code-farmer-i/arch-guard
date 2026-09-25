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
   * **不声明就用组件库适配器给的默认**（`uiKit(antdKit())` 已经声明了 antd 的那份）；
   * 声明了就**以项目为准**（覆盖默认），传 `[]` = 显式关掉这一半。
   * 项目自己的封装（`appToast.success`）属于项目事实，适配器猜不到，仍需在这里声明。
   */
  messageApis?: string[]
  /**
   * **哪些对象属性名算文案**（对象实参形态）：`['message', 'description', 'title']`。
   * 不声明就用组件库适配器的默认（antd：`message` / `description` / `title` / `content`）——
   * 同一批调用里还有 `key` / `duration` 这类非文案键，所以这份名单必须是**声明出来的**，不能全判。
   */
  messageProps?: string[]
}

export function copy(options: CopyOptions = {}): Preset {
  return {
    enable: ['C01', 'C02', 'C03', 'C04', 'C05', 'C06', 'C07'],
    // **只在显式给的时候写**：没写 = 用组件库适配器给的默认（`uiKit(antdKit())` 自带 antd 的文案位）；
    // 写了空数组 = 显式关掉那一半（"这些是开发者提示，不走 i18n"）。
    params: {
      ...(options.messageApis ? { messageApis: options.messageApis } : {}),
      ...(options.messageProps ? { messageProps: options.messageProps } : {}),
    },
  }
}
