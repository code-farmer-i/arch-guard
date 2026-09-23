import { definePack } from '../../engine/pack.js'
import type { Rule } from '../../engine/types.js'

import { copyRules } from './rules/copy.js'
import { adapterRules } from './rules/deps-adapters.js'
import { depsRules } from './rules/deps.js'
import { contextHygieneRules } from './rules/hygiene-context.js'
import { designStyleRules } from './rules/design-styles.js'
import { designTokenRules } from './rules/design-tokens.js'
import { designVendorRules } from './rules/design-vendor.js'
import { metricsRules } from './rules/metrics.js'
import { structureGraphRules } from './rules/structure-graph.js'
import { structureRules } from './rules/structure.js'

/**
 * React 框架包：parser（事实提取）+ 角色表变体 + 语言相关规则 + fixtures。
 * v1 只有这一个 pack；Vue / Svelte 是加法（见 PARADIGM.md §11 可扩展性三层）。
 */
export const reactRules: Rule[] = [
  ...structureRules,
  ...structureGraphRules,
  ...designTokenRules,
  ...designVendorRules,
  ...designStyleRules,
  ...copyRules,
  ...depsRules,
  ...adapterRules,
  ...metricsRules,
  ...contextHygieneRules,
]

export const reactPack = definePack({
  id: 'react',
  rules: reactRules,
  adapters: ['ui-kit', 'router', 'styles', 'i18n', 'data-layer'],
})
