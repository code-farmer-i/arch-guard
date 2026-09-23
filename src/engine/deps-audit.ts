import type { DepsPolicy, ProjectDeps } from './deps.js'
import type { Adapter } from './types.js'

/**
 * `--verify-deps`：把「适配表声明的包」与「package.json 实际依赖」对一遍账。
 *
 * 为什么单独给一个命令：P04 是红线（失败即拒），但它给的是「哪一行错了」；
 * 排查选型漂移时需要的是**全表**——哪些适配器声明了什么、装没装、有没有混进别的组件库。
 */
export interface AuditRow {
  facet: string
  id: string
  packages: { name: string; declared: boolean }[]
}

export interface DepsAudit {
  rows: AuditRow[]
  /** 反向：装了、但不在任何适配表里的组件库包（选型漂移） */
  foreign: string[]
  ok: boolean
}

/** 常见组件库包名 → 库 id：用于识别「装了适配表之外的组件库」 */
const KNOWN_KITS: Record<string, string> = {
  antd: 'antd',
  '@ant-design/x': 'antd',
  '@ant-design/icons': 'antd',
  '@mui/material': 'mui',
  '@chakra-ui/react': 'chakra',
  '@mantine/core': 'mantine',
  'element-plus': 'element-plus',
  'naive-ui': 'naive-ui',
  vuetify: 'vuetify',
  'react-bootstrap': 'bootstrap',
  '@headlessui/react': 'headlessui',
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
    if (names.length === 0) continue
    for (const name of names) declaredByAdapters.add(name)
    rows.push({
      facet: adapter.facet,
      id: adapter.id,
      packages: names.map((name) => ({ name, declared: deps.declared.has(name) })),
    })
  }

  // 反向：装了的组件库里，有适配表之外的
  const adapterKitIds = new Set(
    rows
      .map((row) => KNOWN_KITS[row.packages[0]?.name ?? ''] ?? null)
      .filter((item): item is string => item !== null),
  )
  const foreign = [...deps.declared]
    .filter((name) => KNOWN_KITS[name] !== undefined && !declaredByAdapters.has(name))
    .filter((name) => !adapterKitIds.has(KNOWN_KITS[name] as string))
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
