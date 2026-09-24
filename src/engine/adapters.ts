import type { Adapter, AdapterExamples } from './types.js'

/**
 * 适配器 = 数据，不是插件（见 docs/DESIGN.md §7.4）。
 * 这里只做「声明校验」：字段白名单、类型、正则可编译性、样例完整性。
 * 引擎从不反向调用适配器。
 */

/**
 * **核心面**（引擎自己或框架包有消费者的面）：面名 → 允许字段。
 *
 * 引擎不再枚举"所有面"（E2）：新面由预设用 `defineFacet` 登记，
 * 这里只留引擎无法从别处知道的那几个。
 */
const CORE_FACET_FIELDS: Record<string, string[]> = {
  'ui-kit': [
    'facet',
    'id',
    'specVersion',
    'packages',
    'icons',
    'vendorSelectors',
    'vendorVars',
    'detachedApis',
    'examples',
  ],
  i18n: [
    'facet',
    'id',
    'specVersion',
    'packages',
    'from',
    'hook',
    'fn',
    'resourceDir',
    'languages',
    'examples',
  ],
  metrics: [
    'facet',
    'id',
    'specVersion',
    'coverage',
    'tests',
    'checkChain',
    'depsBudget',
    'examples',
  ],
}

/** 核心面的能力根名（`ui-kit` 的根是 `uiKit`，所以不能靠"根名 = 面名"推） */
const CORE_CAPABILITY_ROOTS: Record<string, string> = {
  'ui-kit': 'uiKit',
  i18n: 'i18n',
  metrics: 'metrics',
}

export interface FacetSpec {
  /** 允许的字段白名单（拼错字段直接报错） */
  fields: string[]
  /** 能力根名（规则 `requires: ['uiKit.vendorSelectors']` 里的 `uiKit`）；缺省 = 面名 */
  capabilityRoot?: string
}

/** 字段白名单按集合处理：登记顺序不该影响"是不是同一个面" */
const normalizeFields = (fields: string[]): string[] =>
  [...new Set(['facet', 'id', 'specVersion', ...fields])].sort()

const facets = new Map<string, FacetSpec>(
  Object.entries(CORE_FACET_FIELDS).map(([name, fields]) => [
    name,
    { fields: normalizeFields(fields), capabilityRoot: CORE_CAPABILITY_ROOTS[name] ?? name },
  ]),
)

/** 已登记的面名（错误信息与自检用） */
export function facetNames(): string[] {
  return [...facets.keys()].sort()
}

/** 读一个面的定义（自检用） */
export function facetSpec(name: string): FacetSpec | undefined {
  return facets.get(name)
}

/**
 * **登记一个适配器面**（E2：加面不再需要动引擎）。
 *
 * 谁调用：预设自己 —— 放在定义该面适配器的模块顶部（同一模块或它 import 的模块），
 * 保证"面定义先于适配器定义"（`defineAdapter` 会校验面已登记）。
 *
 * 同一个面重复登记**同样的定义**是幂等的（ESM 模块可能被多次求值）；
 * 定义不同则报错 —— 两份定义会让字段校验按加载顺序飘。
 */
export function defineFacet(name: string, spec: FacetSpec): void {
  if (name.length === 0) throw new AdapterError('适配器面名不能为空')
  if (spec.fields.length === 0) throw new AdapterError(`[${name}] 字段白名单不能为空`)
  const normalized: FacetSpec = {
    fields: normalizeFields(spec.fields),
    capabilityRoot: spec.capabilityRoot ?? name,
  }
  const existing = facets.get(name)
  if (existing) {
    const same =
      existing.fields.join('\n') === normalized.fields.join('\n') &&
      existing.capabilityRoot === normalized.capabilityRoot
    if (!same) {
      throw new AdapterError(
        `适配器面 ${name} 已被登记为不同定义（已登记字段：${existing.fields.join(', ')}）—— 面定义只能有一处真相`,
      )
    }
    return
  }
  facets.set(name, normalized)
}

/** 能力根名 → 适配器面（规则 `requires: ['uiKit.vendorSelectors']` 靠它反查） */
export function facetOfCapabilityRoot(root: string): string | undefined {
  for (const [name, spec] of facets) {
    if ((spec.capabilityRoot ?? name) === root) return name
  }
  return undefined
}

/**
 * 正则类字段：`examples` 的 hit / miss 会拿真正则去验证（§7.4 第 4 条）。
 * `modulePatterns`（组件样式文件形态）与选择器 / 变量前缀同类 —— 写歪了只会在规则里静默不生效。
 */
const PATTERN_FIELDS = new Set(['vendorSelectors', 'vendorVars', 'modulePatterns'])

export class AdapterError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AdapterError'
  }
}

function assertStringArray(value: unknown, field: string, facet: string): void {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new AdapterError(`[${facet}] 字段 ${field} 必须是字符串数组`)
  }
}

function validatePatterns(value: unknown, field: string, facet: string): void {
  assertStringArray(value, field, facet)
  for (const pattern of value as string[]) {
    try {
      new RegExp(pattern)
    } catch {
      throw new AdapterError(`[${facet}] 字段 ${field} 里的正则无法编译：${pattern}`)
    }
  }
}

function validateExamples(
  examples: AdapterExamples | undefined,
  facet: string,
  spec: Record<string, unknown>,
): void {
  if (!examples) return
  for (const [field, value] of Object.entries(examples)) {
    const sample = value as { hit?: unknown; miss?: unknown }
    if (!Array.isArray(sample?.hit) || !Array.isArray(sample?.miss)) {
      throw new AdapterError(`[${facet}] examples.${field} 必须同时给出 hit 与 miss 样例`)
    }
    if (!PATTERN_FIELDS.has(field)) continue
    const patterns = spec[field]
    if (!Array.isArray(patterns)) continue
    const regexes = (patterns as string[]).map((pattern) => new RegExp(pattern))
    for (const sampleText of sample.hit as string[]) {
      if (!regexes.some((regex) => regex.test(sampleText))) {
        throw new AdapterError(
          `[${facet}] examples.${field}.hit 与声明不符：${sampleText} 未被任何 pattern 命中`,
        )
      }
    }
    for (const sampleText of sample.miss as string[]) {
      if (regexes.some((regex) => regex.test(sampleText))) {
        throw new AdapterError(
          `[${facet}] examples.${field}.miss 与声明不符：${sampleText} 被 pattern 命中了`,
        )
      }
    }
  }
}

/** 校验并冻结一个适配器声明；未知字段直接报错（防拼写错导致静默失能） */
export function defineAdapter<T extends Adapter>(facet: string, spec: Record<string, unknown>): T {
  const definition = facets.get(facet)
  if (!definition) {
    throw new AdapterError(
      `未知适配器面：${facet}（可用：${facetNames().join(', ')}）\n` +
        '（新面由预设用 defineFacet 登记 —— 面清单不再写死在引擎里）',
    )
  }
  const allowed = definition.fields
  const unknown = Object.keys(spec).filter((key) => !allowed.includes(key))
  if (unknown.length > 0) {
    throw new AdapterError(
      `[${facet}] 未知字段：${unknown.join(', ')}（允许：${allowed.join(', ')}）`,
    )
  }
  if (typeof spec.id !== 'string' || spec.id.length === 0)
    throw new AdapterError(`[${facet}] 缺少 id`)
  if (spec.packages !== undefined) assertStringArray(spec.packages, 'packages', facet)
  if (spec.vendorSelectors !== undefined)
    validatePatterns(spec.vendorSelectors, 'vendorSelectors', facet)
  if (spec.vendorVars !== undefined) validatePatterns(spec.vendorVars, 'vendorVars', facet)
  if (spec.styleProps !== undefined) assertStringArray(spec.styleProps, 'styleProps', facet)
  // 方案面的**形态**词汇：入口文件名（S 域）与组件样式形态（D 域）
  if (spec.routeFiles !== undefined) assertStringArray(spec.routeFiles, 'routeFiles', facet)
  if (spec.modulePatterns !== undefined)
    validatePatterns(spec.modulePatterns, 'modulePatterns', facet)
  if (spec.detachedApis !== undefined) {
    if (!Array.isArray(spec.detachedApis))
      throw new AdapterError(`[${facet}] detachedApis 必须是数组`)
    for (const entry of spec.detachedApis as { from?: unknown; members?: unknown }[]) {
      if (!Array.isArray(entry.from) || !Array.isArray(entry.members)) {
        throw new AdapterError(`[${facet}] detachedApis 每项必须带 from[] 与 members[]`)
      }
    }
  }
  validateExamples(spec.examples as AdapterExamples | undefined, facet, spec)
  return Object.freeze({ facet, ...spec }) as unknown as T
}

/** 读取适配器的能力路径值：`uiKit.vendorSelectors` → adapter.vendorSelectors */
export function capabilityValue(adapter: unknown, path: string[]): unknown {
  let current: unknown = adapter
  for (const segment of path) {
    if (current == null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[segment]
  }
  return current
}

/** 能力是否真的可用：非空数组 / 非空字符串 / 显式 true */
export function isCapabilityPresent(value: unknown): boolean {
  if (value === undefined || value === null || value === false) return false
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'string') return value.length > 0
  if (typeof value === 'object') return Object.keys(value).length > 0
  return Boolean(value)
}
