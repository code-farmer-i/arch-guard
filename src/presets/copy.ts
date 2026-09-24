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
export function copy(): Preset {
  return { enable: ['C02', 'C03', 'C04', 'C05', 'C06', 'C07'] }
}
