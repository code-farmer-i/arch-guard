import { CAPABILITY_ROOTS, capabilityValue, isCapabilityPresent } from './adapters.js'
import type { Config, Domain, Level, Rule } from './types.js'

/** 能力协商：未声明的能力对应规则**不注册**，并记入 skipped 供报告展示 */
export function hasCapability(config: Config, capability: string): boolean {
  const [root, ...rest] = capability.split('.')
  if (!root) return false
  const facet = CAPABILITY_ROOTS[root]
  if (!facet) return false
  const adapter = Object.values(config.adapters).find((candidate) => candidate.facet === facet)
  if (!adapter) return false
  if (rest.length === 0) return true
  return isCapabilityPresent(capabilityValue(adapter, rest))
}

const LEVEL_ORDER: Record<Level, number> = { L1: 1, L2: 2, L3: 3, L4: 4 }

export interface RegistryFilters {
  only?: string[]
  domain?: Domain[]
  minLevel?: Level
}

export interface RegistryResult {
  enabled: Rule[]
  skipped: { rule: string; reason: string }[]
  unknownEnabled: string[]
  filters: RegistryFilters
}

export function createRegistry(rules: Rule[], config: Config, filters: RegistryFilters = {}): RegistryResult {
  const all = new Map(rules.map((rule) => [rule.id, rule]))
  const enable = config.enable
  const requested = enable === 'all' ? [...all.keys()] : enable
  const unknownEnabled = requested.filter((id) => !all.has(id))

  const enabled: Rule[] = []
  const skipped: { rule: string; reason: string }[] = []

  for (const id of requested) {
    const rule = all.get(id)
    if (!rule) continue
    if (filters.only && filters.only.length > 0 && !filters.only.includes(rule.id)) continue
    if (filters.domain && filters.domain.length > 0 && !filters.domain.includes(rule.domain)) continue
    if (filters.minLevel && LEVEL_ORDER[rule.level] > LEVEL_ORDER[filters.minLevel]) continue
    const missing = (rule.requires ?? []).filter((capability) => !hasCapability(config, capability))
    if (missing.length > 0) {
      skipped.push({ rule: rule.id, reason: `能力未声明：${missing.join(', ')}` })
      continue
    }
    enabled.push(rule)
  }

  return { enabled, skipped, unknownEnabled, filters }
}
