import type { DepsPolicy, ProjectDeps } from './deps.js'
import { kitFingerprints } from '../data/kit-fingerprints.js'
import type { Adapter } from './types.js'

/**
 * `--verify-deps`：把「适配表声明的包」与「package.json 实际依赖」对一遍账，**并列出整张适配表**。
 *
 * 为什么单独给一个命令：P04 是红线（失败即拒），但它给的是「哪一行错了」；
 * 排查选型漂移时需要的是**全表**——哪些适配器在生效、声明了什么形态、装没装、有没有混进别的组件库。
 * 报告里的 `adapters-in-use` notice 只报 `facet=id`；字段级全貌在这里。
 */
export interface AuditRow {
  facet: string
  id: string
  /** 适配器契约版本（搬仓库 / 升级后行为变了，先看它） */
  specVersion?: string
  packages: { name: string; declared: boolean }[]
  /**
   * 面内其余字段（形态 / 落点，如 `routeFiles` / `modulePatterns` / `resourceDir`）——
   * **没有包可对账的 kit 也要在表里**（CSS Module 就是"没有 npm 包"的方案），
   * 否则"我配了 `styles()` 吗、它认哪种文件"这两个问题在 `--verify-deps` 里看不见。
   */
  fields: { name: string; value: string }[]
}

export interface DepsAudit {
  rows: AuditRow[]
  /** 反向：装了、但不在任何适配表里的组件库包（选型漂移） */
  foreign: string[]
  ok: boolean
}

/** 这几个字段已在行首 / 包清单里表达过，不再重复列进 `fields` */
const META_FIELDS = new Set(['facet', 'id', 'specVersion', 'packages', 'from', 'examples'])

/** 字段值 → 一行可读文本（数组用 ` / ` 连；空数组写明"空"—— 那是"本方案没有这种文件"的声明） */
function renderFieldValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.length === 0 ? '（空）' : value.map((item) => renderFieldValue(item)).join(' / ')
  }
  if (value !== null && typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export function auditAdapterDeps(
  config: { adapters: Record<string, Adapter> },
  deps: ProjectDeps,
): DepsAudit {
  const rows: AuditRow[] = []
  const declaredByAdapters = new Set<string>()

  for (const adapter of Object.values(config.adapters)) {
    const spec = adapter as Adapter & { packages?: string[]; from?: string[] }
    const names = [...(spec.packages ?? []), ...(spec.from ?? [])]
    for (const name of names) declaredByAdapters.add(name)
    rows.push({
      facet: adapter.facet,
      id: adapter.id,
      ...(adapter.specVersion ? { specVersion: adapter.specVersion } : {}),
      packages: names.map((name) => ({ name, declared: deps.declared.has(name) })),
      fields: Object.entries(adapter as Record<string, unknown>)
        .filter(([name]) => !META_FIELDS.has(name))
        .map(([name, value]) => ({ name, value: renderFieldValue(value) })),
    })
  }

  // 反向：装了的组件库里，有适配表之外的
  // 指纹表是**库名的唯一出处**（`data/kit-fingerprints.ts`）—— 引擎里不再放库名
  const kitIdOf = (packageName: string): string | undefined =>
    kitFingerprints.find((kit) => kit.packages.includes(packageName))?.id
  const adapterKitIds = new Set(
    rows
      .map((row) => kitIdOf(row.packages[0]?.name ?? ''))
      .filter((item): item is string => item !== undefined),
  )
  const foreign = [...deps.declared]
    .filter((name) => kitIdOf(name) !== undefined && !declaredByAdapters.has(name))
    .filter((name) => !adapterKitIds.has(kitIdOf(name) as string))
    .sort()

  const missing = rows.some((row) => row.packages.some((item) => !item.declared))
  return { rows, foreign, ok: !missing && foreign.length === 0 }
}

/** 依赖策略 vs 平台/适配器的冲突（P 域之外的交叉检查，--verify-deps 也会打印） */
export function describePolicy(policy: DepsPolicy): string {
  const allow = policy.allow.length > 0 ? policy.allow.join(', ') : '（未启用白名单）'
  const deny = policy.deny.length > 0 ? policy.deny.join(', ') : '（无硬禁令）'
  const capabilities = Object.entries(policy.capabilities)
    .map(([capability, pkg]) => `${capability}→${pkg}`)
    .join(', ')
  return `allow: ${allow} | deny: ${deny}${capabilities ? ` | 能力首选: ${capabilities}` : ''}`
}
