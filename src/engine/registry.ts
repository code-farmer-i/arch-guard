import { CAPABILITY_ROOTS, capabilityValue, isCapabilityPresent } from './adapters.js'
import type { SkippedRule } from './codes.js'
import type { Config, Domain, Level, Rule } from './types.js'

/**
 * 能力协商：未声明的能力对应规则**不注册**，并记入 skipped 供报告展示。
 *
 * 两种能力根：**适配器型**（`uiKit.x` / `i18n.x` / `metrics.x` → 找对应 facet 的字段）与
 * **参数型**（`designSystem.x` → 读 `config.params.x`）—— 后者表达"项目事实"（如令牌前缀），
 * 让缺它时规则**明列停用**而不是空转或误报。
 */
/**
 * 参数型能力的根：读 `config.params`（**导出给盘点工具用**，别让外部再抄一份名单）。
 * `structure.slots` 表达的是**范式事实** ——「本范式的角色带槽位语义（views / hooks / model / lib）」。
 * canonical 声明了它，library 与 fsd 没有（它们的角色不带槽位）→ S13 在那两个范式下**明列停用**，
 * 而不是注册了却永远判不出东西（`--explain` 也就不会再承诺它）。
 */
export const PARAM_CAPABILITY_ROOTS = new Set(['designSystem', 'structure'])

export function hasCapability(config: Config, capability: string): boolean {
  const [root, ...rest] = capability.split('.')
  if (!root) return false
  if (PARAM_CAPABILITY_ROOTS.has(root))
    return isCapabilityPresent(capabilityValue(config.params, rest))
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
  skipped: SkippedRule[]
  unknownEnabled: string[]
  filters: RegistryFilters
}

export function createRegistry(
  rules: Rule[],
  config: Config,
  filters: RegistryFilters = {},
): RegistryResult {
  const all = new Map(rules.map((rule) => [rule.id, rule]))
  const enable = config.enable
  const disabled = new Set(config.disable ?? [])
  const requested = (enable === 'all' ? [...all.keys()] : enable).filter((id) => !disabled.has(id))
  const unknownEnabled = requested.filter((id) => !all.has(id))

  const enabled: Rule[] = []
  const skipped: SkippedRule[] = []

  for (const id of requested) {
    const rule = all.get(id)
    if (!rule) continue
    if (filters.only && filters.only.length > 0 && !filters.only.includes(rule.id)) continue
    if (filters.domain && filters.domain.length > 0 && !filters.domain.includes(rule.domain))
      continue
    if (filters.minLevel && LEVEL_ORDER[rule.level] > LEVEL_ORDER[filters.minLevel]) continue
    const missing = (rule.requires ?? []).filter((capability) => !hasCapability(config, capability))
    if (missing.length > 0) {
      skipped.push({
        rule: rule.id,
        code: 'capability-missing',
        missing,
        reason: `能力未声明：${missing.join(', ')}`,
      })
      continue
    }
    enabled.push(rule)
  }

  return { enabled, skipped, unknownEnabled, filters }
}
