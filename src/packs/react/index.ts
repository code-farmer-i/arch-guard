import type { Rule } from '../../engine/types.js'

import { depsRules } from './rules/deps.js'
import { designTokenRules } from './rules/design-tokens.js'
import { designVendorRules } from './rules/design-vendor.js'
import { hygieneRules } from './rules/hygiene.js'
import { structureRules } from './rules/structure.js'

/**
 * React 框架包：parser（事实提取）+ 角色表变体 + 语言相关规则 + fixtures。
 * v1 只有这一个 pack；Vue / Svelte 是加法（见 PARADIGM.md §11 可扩展性三层）。
 */
export interface Pack {
  id: string
  rules: Rule[]
}

export const reactRules: Rule[] = [
  ...structureRules,
  ...designTokenRules,
  ...designVendorRules,
  ...depsRules,
  ...hygieneRules,
]

export const reactPack: Pack = {
  id: 'react',
  rules: reactRules,
}
