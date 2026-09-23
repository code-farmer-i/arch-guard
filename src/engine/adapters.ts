import type { Adapter, AdapterExamples } from './types.js'

/**
 * 适配器 = 数据，不是插件（见 docs/DESIGN.md §7.4）。
 * 这里只做「声明校验」：字段白名单、类型、正则可编译性、样例完整性。
 * 引擎从不反向调用适配器。
 */

const FACET_FIELDS: Record<string, string[]> = {
  'ui-kit': [
    'facet',
    'id',
    'specVersion',
    'packages',
    'icons',
    'vendorSelectors',
    'vendorVars',
    'detachedApis',
    'styleProps',
    'policy',
    'examples',
  ],
  'data-layer': [
    'facet',
    'id',
    'specVersion',
    'packages',
    'serverState',
    'clientState',
    'examples',
  ],
  router: [
    'facet',
    'id',
    'specVersion',
    'packages',
    'mode',
    'navigateHooks',
    'linkComponent',
    'pathProp',
    'routesFile',
    'pathsModule',
    'examples',
  ],
  styles: ['facet', 'id', 'specVersion', 'kind', 'modulePattern', 'classAccess', 'examples'],
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
    'format',
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

export const FACETS = Object.keys(FACET_FIELDS)

/** 能力根名 → 适配器面（capability 用 `uiKit.vendorSelectors` 这种路径表达） */
export const CAPABILITY_ROOTS: Record<string, string> = {
  metrics: 'metrics',
  uiKit: 'ui-kit',
  dataLayer: 'data-layer',
  router: 'router',
  styles: 'styles',
  i18n: 'i18n',
}

const PATTERN_FIELDS = new Set(['vendorSelectors', 'vendorVars', 'modulePattern'])

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
  const allowed = FACET_FIELDS[facet]
  if (!allowed) throw new AdapterError(`未知适配器面：${facet}（可用：${FACETS.join(', ')}）`)
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
  if (spec.modulePattern !== undefined)
    validatePatterns([spec.modulePattern], 'modulePattern', facet)
  if (spec.styleProps !== undefined) assertStringArray(spec.styleProps, 'styleProps', facet)
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
