import { defineSourceForm, type SourceFormBinding } from '../engine/source-form.js'

import { coreRules } from './core/index.js'

/**
 * **引擎自带的源码形态绑定表**（层 4）：形态 → 规则集 + 它支持的方案面。
 *
 * 这是"注入点"的缺省值：`loadConfig({ sourceForms: builtinSourceForms })`。
 * 宿主**不写**它 —— 配置里只写 `sourceForm: 'react'`（见 [ADR-0009](../..//docs/adr/0009-source-form-is-a-scalar.md)）。
 *
 * 今天两个形态**共用同一份** `coreRules` 与同一张适配面清单（v1 没有任何语言专属的已实现规则），
 * 所以它们只差一个 id —— 这正是"`packs` 数组传递的信息量 = 一个枚举值"那个结论的来源。
 * Vue / Svelte 落地时：`packs/<形态>/` 里各自加 parser + 角色表变体 + 语言专属规则，
 * 这里换掉 `rules` 引用即可（数据表那边加一行扩展名）。
 */
const CORE_FACETS = [
  'ui-kit',
  'i18n',
  'metrics',
  'router',
  'data-layer',
  'styles',
  'call-sites',
  'endpoints',
  // R-138 加的 `http` 面：**以前这里的名单漏了它** —— 同时声明 `packs: [reactPack]` 与
  // `http(axiosKit())` 会被 facet 校验拒掉（0.8.0 / 0.9.0 里是真实存在的 bug，见 CHANGELOG）。
  'http',
  'error-policy',
  'permissions',
  'analytics',
  'env-reads',
]

export const builtinSourceForms: SourceFormBinding[] = [
  defineSourceForm({ id: 'typescript', rules: coreRules, adapters: CORE_FACETS }),
  defineSourceForm({ id: 'react', rules: coreRules, adapters: CORE_FACETS }),
]

/** 有实现的形态名（报错时列给用户看） */
export const implementedSourceForms = (): string[] => builtinSourceForms.map((item) => item.id)
