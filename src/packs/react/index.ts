import { definePack } from '../../engine/pack.js'

import { coreRules } from '../core/index.js'

/**
 * **React 源码形态**的框架包：`framework: 'react'` 表示这个宿主是 React 应用 ——
 * 它决定"哪些扩展名归本包管"（`.tsx` 由 parser 按扩展名处理，见 `facts.ts` 的 `SCRIPT_KIND`）
 * 以及 S20 的报错文案。
 *
 * 与 `tsPack` 的关系：今天两者引用**同一份** `coreRules`，所以规则与适配面完全相同 ——
 * v1 没有任何 JSX 专属的**已实现**规则（C01 裸文案、D15 内联样式按 §4.9 委派给 eslint）。
 * 命名在这里仍有意义：将来 JSX 专属规则（内联样式形态、模板插值等）落地时，
 * 它们的家是 **`packs/react/rules/`**（本目录），而框架无关的规则留在 `packs/core/rules/`。
 */
export const reactPack = definePack({
  id: 'react',
  framework: 'react',
  rules: coreRules,
  // 只列**真有规则消费**的 facet（router / styles / data-layer 没有消费者，已删）；metrics 反而以前漏了
  adapters: ['ui-kit', 'i18n', 'metrics', 'router', 'data-layer', 'styles', 'call-sites'],
})
