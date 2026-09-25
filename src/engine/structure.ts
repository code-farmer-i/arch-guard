import type { ResolvedStructure, RoleDescriptor, StructureSpec } from './types.js'

/**
 * 结构声明的解析与校验（`structure` 字段 → `ResolvedStructure`）。
 *
 * 两个 fail-closed 判断都在这里，而不是留给规则各自兜底：
 *   1. **声明必须有人认**：维度名（角色表里 `group` 的捕获名）与角色 id 必须真实存在，
 *      否则"配了却没有任何角色命中它"会静默失效 —— 静默失效比报错难查得多。
 *   2. **同一份声明只能有一处真相**：同维度/同角色的两份不同声明直接报错，
 *      而不是让后一份悄悄覆盖前一份（多个预设叠加时最容易踩）。
 *
 * 合并语义是**加法**：布尔取或、字符串数组取并集、带键的对象数组按键合并（相同才允许重复）。
 */
export class StructureDeclarationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StructureDeclarationError'
  }
}

/** 稳定序列化：键顺序不同不算差异（宿主的写法不该影响判定） */
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : 1))
    return `{${entries.map(([key, item]) => `${key}:${stable(item)}`).join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

function union(first: string[] | undefined, second: string[] | undefined): string[] {
  return [...new Set([...(first ?? []), ...(second ?? [])])]
}

/**
 * 多个预设之间的结构声明合并：**加法**，不是覆盖。
 *
 * 字符串数组取并集；带键的对象数组**直接拼接**（键冲突/内容冲突在 `resolveStructure` 里统一报错，
 * 这样"两份声明打架"只有一个报错出口）。布尔取或。
 */
export function mergeStructureSpec(
  prev: StructureSpec | undefined,
  next: StructureSpec | undefined,
): StructureSpec {
  if (!prev) return { ...next }
  if (!next) return { ...prev }
  return {
    ...(prev.order === true || next.order === true ? { order: true } : {}),
    isolate: union(prev.isolate, next.isolate),
    publicApi: union(prev.publicApi, next.publicApi),
    publicApiUnits: [...(prev.publicApiUnits ?? []), ...(next.publicApiUnits ?? [])],
    segmentedGroups: union(prev.segmentedGroups, next.segmentedGroups),
    reservedNames: union(prev.reservedNames, next.reservedNames),
    groupCountLimits: [...(prev.groupCountLimits ?? []), ...(next.groupCountLimits ?? [])],
    directoryItemLimits: [...(prev.directoryItemLimits ?? []), ...(next.directoryItemLimits ?? [])],
    groupInDegree: [...(prev.groupInDegree ?? []), ...(next.groupInDegree ?? [])],
    nameCollisions: [...(prev.nameCollisions ?? []), ...(next.nameCollisions ?? [])],
    repetitiveNaming: union(prev.repetitiveNaming, next.repetitiveNaming),
    pluralConsistency: [...(prev.pluralConsistency ?? []), ...(next.pluralConsistency ?? [])],
    degreeLimits: [...(prev.degreeLimits ?? []), ...(next.degreeLimits ?? [])],
    importLocality: union(prev.importLocality, next.importLocality),
  }
}

/**
 * 按键合并带键的对象数组：
 *   - **预设内部**（`base`，多个预设拼接而来）同一键出现两份不同内容 → 报错：
 *     两个预设对同一维度/角色给出不同数值是"两个真相"，静默取一个会让另一个看不见；
 *   - **`overrides`** 里同一键 = 宿主的**显式覆盖**（和 `overrides.thresholds` 一个语义）：
 *     预设给默认值（`excessive-slicing` 是 20），宿主想调就调，不必去改预设。
 */
function mergeKeyed<T>(
  field: keyof StructureSpec,
  keyOf: (item: T) => string,
  base: readonly T[],
  overrides: readonly T[],
): T[] {
  const out = new Map<string, T>()
  for (const item of base) {
    const key = keyOf(item)
    const prev = out.get(key)
    if (prev !== undefined && stable(prev) !== stable(item)) {
      throw new StructureDeclarationError(
        `structure.${String(field)} 对「${key}」有两份不同的声明：${stable(prev)} / ${stable(item)}\n` +
          '（同一份声明只能有一处真相：要改就改预设，或用 overrides.structure 显式覆盖）',
      )
    }
    out.set(key, item)
  }
  for (const item of overrides) out.set(keyOf(item), item)
  return [...out.values()]
}

export function resolveStructure(input: {
  preset?: StructureSpec
  overrides?: StructureSpec
  roles: RoleDescriptor[]
}): ResolvedStructure {
  const { preset, overrides, roles } = input
  const structure: ResolvedStructure = {
    order: preset?.order === true || overrides?.order === true,
    isolate: union(preset?.isolate, overrides?.isolate),
    publicApi: union(preset?.publicApi, overrides?.publicApi),
    publicApiUnits: mergeKeyed(
      'publicApiUnits',
      (item) => item.role,
      preset?.publicApiUnits ?? [],
      overrides?.publicApiUnits ?? [],
    ),
    segmentedGroups: union(preset?.segmentedGroups, overrides?.segmentedGroups),
    reservedNames: union(preset?.reservedNames, overrides?.reservedNames),
    groupCountLimits: mergeKeyed(
      'groupCountLimits',
      (item) => item.dimension,
      preset?.groupCountLimits ?? [],
      overrides?.groupCountLimits ?? [],
    ),
    directoryItemLimits: mergeKeyed(
      'directoryItemLimits',
      (item) => item.role,
      preset?.directoryItemLimits ?? [],
      overrides?.directoryItemLimits ?? [],
    ),
    groupInDegree: mergeKeyed(
      'groupInDegree',
      (item) => item.dimension,
      preset?.groupInDegree ?? [],
      overrides?.groupInDegree ?? [],
    ),
    nameCollisions: mergeKeyed(
      'nameCollisions',
      (item) => item.dimension,
      preset?.nameCollisions ?? [],
      overrides?.nameCollisions ?? [],
    ),
    repetitiveNaming: union(preset?.repetitiveNaming, overrides?.repetitiveNaming),
    pluralConsistency: mergeKeyed(
      'pluralConsistency',
      (item) => item.dimension,
      preset?.pluralConsistency ?? [],
      overrides?.pluralConsistency ?? [],
    ),
    degreeLimits: mergeKeyed(
      'degreeLimits',
      (item) => item.role,
      preset?.degreeLimits ?? [],
      overrides?.degreeLimits ?? [],
    ),
    importLocality: union(preset?.importLocality, overrides?.importLocality),
    couplingLimits: mergeKeyed(
      'couplingLimits',
      (item) => item.dimension,
      preset?.couplingLimits ?? [],
      overrides?.couplingLimits ?? [],
    ),
    migrating: union(preset?.migrating, overrides?.migrating),
    clientState: [...(preset?.clientState ?? []), ...(overrides?.clientState ?? [])],
    // 单值声明：overrides 给了就用 overrides（与 thresholds 一个语义）
    authRedirects: overrides?.authRedirects ?? preset?.authRedirects,
  }
  validate(structure, roles)
  return structure
}

function validate(structure: ResolvedStructure, roles: RoleDescriptor[]): void {
  const dimensions = new Set(
    roles.map((role) => role.group).filter((group): group is string => typeof group === 'string'),
  )
  const roleIds = new Set(roles.map((role) => role.id))
  // 捕获名（`{domain}` / `{slice}` / 自定义）：S39 的维度按它判定 ——
  // 注意与上面的 `dimensions`（角色显式声明的 `group`）不是一回事：canonical 的域是**捕获名**，没有 `group`
  const captureNames = new Set<string>()
  for (const role of roles) {
    for (const match of role.pattern.matchAll(/\{([a-zA-Z0-9_]+)\}/g))
      captureNames.add(match[1] ?? '')
  }

  const needDimension = (field: string, value: string): void => {
    if (dimensions.has(value)) return
    throw new StructureDeclarationError(
      `structure.${field} 声明了「${value}」，但角色表里没有任何角色用它做组维度` +
        `（可用：${[...dimensions].join(' / ') || '（无）'}）\n` +
        "（组维度是角色描述符里的 group: '<捕获名>'；声明一个不存在的维度等于这条声明永远不会生效）",
    )
  }
  /**
   * 角色 id 是**选择器**（指向角色表里的一条）。它不存在时直接报错，而不是记一条顾问消息：
   * 声明了却永远不生效是"静默失能"，跟维度名写错是同一类问题。
   * （宿主若整体替换了角色表，就必须同时让这些声明指向真实角色 —— 否则该删掉这条声明。）
   */
  const needRole = (field: string, value: string): void => {
    if (roleIds.has(value)) return
    throw new StructureDeclarationError(
      `structure.${field} 指向的角色「${value}」不在角色表里 —— 这条声明永远不会生效\n` +
        '（宿主用 overrides.roles 整体替换了角色表？那就把声明一起改掉，或删掉它）',
    )
  }

  for (const dimension of structure.isolate) needDimension('isolate', dimension)
  for (const dimension of structure.publicApi) needDimension('publicApi', dimension)
  for (const dimension of structure.segmentedGroups) needDimension('segmentedGroups', dimension)
  for (const dimension of structure.repetitiveNaming) needDimension('repetitiveNaming', dimension)
  for (const dimension of structure.importLocality) needDimension('importLocality', dimension)
  for (const item of structure.groupCountLimits) needDimension('groupCountLimits', item.dimension)
  for (const item of structure.groupInDegree) needDimension('groupInDegree', item.dimension)
  for (const item of structure.nameCollisions) needDimension('nameCollisions', item.dimension)
  for (const item of structure.pluralConsistency) needDimension('pluralConsistency', item.dimension)
  for (const item of structure.publicApiUnits) needRole('publicApiUnits', item.role)
  for (const item of structure.directoryItemLimits) needRole('directoryItemLimits', item.role)
  for (const item of structure.couplingLimits) {
    if (!captureNames.has(item.dimension)) {
      throw new StructureDeclarationError(
        `structure.couplingLimits 的维度「${item.dimension}」不是任何角色的捕获名 —— 这条声明永远不会命中\n` +
          `（可用：${[...captureNames].sort().join(' / ') || '（无）'}）`,
      )
    }
    if (item.maxFanIn === undefined && item.maxFanOut === undefined) {
      throw new StructureDeclarationError(
        `structure.couplingLimits 对维度「${item.dimension}」既没给 maxFanIn 也没给 maxFanOut —— 这条声明什么都没说`,
      )
    }
    for (const [field, value] of [
      ['maxFanIn', item.maxFanIn],
      ['maxFanOut', item.maxFanOut],
    ] as const) {
      if (value === undefined) continue
      if (!Number.isInteger(value) || value < 1) {
        throw new StructureDeclarationError(
          `structure.couplingLimits 的 ${field} 必须是 ≥1 的整数（收到 ${String(value)}）`,
        )
      }
    }
  }
  for (const spec of structure.clientState) {
    if (!spec.naming || spec.naming.trim() === '') {
      throw new StructureDeclarationError('structure.clientState 的 naming 不能为空')
    }
    if (spec.in.length === 0) {
      throw new StructureDeclarationError(
        `structure.clientState 的 naming「${spec.naming}」没给落点（in）—— 这条声明等于"哪里都不许"，可疑`,
      )
    }
  }
  if (structure.authRedirects) {
    if (structure.authRedirects.loginPaths.length === 0) {
      throw new StructureDeclarationError('structure.authRedirects 的 loginPaths 不能为空')
    }
    if (structure.authRedirects.in.length === 0) {
      throw new StructureDeclarationError(
        'structure.authRedirects 的 in 不能为空 —— 没有落点就等于"哪里都不许跳登录"',
      )
    }
  }
  for (const glob of structure.migrating) {
    if (typeof glob !== 'string' || glob.trim() === '') {
      throw new StructureDeclarationError('structure.migrating 里的每一项都必须是非空 glob')
    }
  }
  for (const item of structure.degreeLimits) {
    needRole('degreeLimits', item.role)
    if (item.maxIn === undefined && item.maxOut === undefined) {
      throw new StructureDeclarationError(
        `structure.degreeLimits 对角色「${item.role}」既没给 maxIn 也没给 maxOut —— 这条声明什么都没说`,
      )
    }
  }
}
