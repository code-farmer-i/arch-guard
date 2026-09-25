import { definePack } from '../../engine/pack.js'

import { coreRules } from '../core/index.js'

/**
 * **TS / JS 源码形态**的框架包（框架无关）。
 *
 * 用在：库 / CLI / 纯 TS 项目 —— 它们的源码形态就是 `.ts` 家族，不该被一个叫做 "react" 的包量。
 * 名称与 `framework` 指的是**源码形态**（见 `src/data/framework-sources.ts`），不是"用了哪个框架"。
 *
 * 与 `reactPack` 的关系：今天两者引用**同一份** `coreRules` —— v1 没有任何 JSX 专属的**已实现**规则
 * （C01 裸文案、D15 内联样式按 §4.9 委派给 eslint）。JSX 专属规则回填时，
 * 它们进 `packs/react/rules/`，那时两个包才真正分化（见 PARADIGM §11）。
 */
export const tsPack = definePack({
  id: 'typescript',
  framework: 'typescript',
  rules: coreRules,
  // 与 reactPack 相同：适配面由**规则实际消费的字段**决定，而两者今天跑的是同一份规则
  // （不为了"看起来有区别"去少写一个面 —— 那是没人消费的声明）
  adapters: ['ui-kit', 'i18n', 'metrics', 'router', 'data-layer', 'styles', 'call-sites'],
})
