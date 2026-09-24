import { buildRoleIndex, resolveRole, type RoleIndex, type RoleResolution } from './scan.js'
import { DOMAIN_LABEL, type ReportFormat } from './report.js'
import type { Config, Rule } from './types.js'
import { exists } from './util.js'

/**
 * `--explain <路径>`：**写之前**把这个路径的契约讲清楚 —— 角色 / 能依赖谁 / 该放哪 / 适用哪些规则。
 *
 * 为什么它对 agent 最值：门禁平时只在**事后**说"你错了"，agent 于是靠试错逼近规范；
 * 而"这个文件是什么角色、能 import 谁、该放哪"全是 **L1–L3 的既有数据**（角色表 + 布局 + 结构声明 + config.params），
 * 一条规则都不用跑，也就**零误报**。它把约束从"考试"变成"写作规范"。
 *
 * 边界（诚实）：解释的是**形态契约**，不是"这段代码写得好不好"（L5）。规则是否命中取决于文件内容 ——
 * 这里列出的是"本配置启用了哪些规则、各自要求什么"，不是"这个文件一定会被哪几条判"（那需要规则自述覆盖面，
 * 当前产出契约里没有这个事实，见 README 的 Roadmap）。
 */

export interface ExplainRule {
  id: string
  title: string
  domain: string
  level: string
  severity: string
  hint?: string
}

export interface PathExplanation {
  path: string
  exists: boolean
  status: RoleResolution['status']
  /** 这条路径是否真的受契约约束（域外 / ignore / 资源文件为 false，此时不列契约，免得自相矛盾） */
  judged: boolean
  role: {
    id: string
    layer: number
    slot: string | null
    domain: string | null
    group: string | null
    groupName: string | null
  } | null
  /** 歧义时的全部命中角色 */
  ambiguousRoles: string[]
  /** 「该放哪」——来自 `placementHint()`（S01/S03 的同一份提示，不是第二处真相） */
  placement: string | null
  contract: {
    srcRoot: string
    layout: { app: string; modules: string; shared: string }
    entries: string[]
    structure: { order: boolean; isolate: string[]; publicApi: string[] }
    /** 由 layout + 结构声明派生的"能依赖谁" */
    imports: string[]
    /** 本范式认这些槽位（帮 agent 选位置） */
    slots: string[]
  }
  naming: { hookPrefix: string; viewSuffix: string }
  /** 与落点有关的路径参数（令牌 / 样式 / 存储 / i18n） */
  pathParams: Record<string, string>
  rules: { enabled: ExplainRule[]; skipped: { rule: string; reason: string }[] }
  notes: string[]
}

/** 只把"落点"类参数念出来，避免把 deps 的 allow/deny 也倒给读者 */
const PATH_PARAM_KEYS = [
  'styleDir',
  'tokenDir',
  'vendorDir',
  'paletteFile',
  'themeFile',
  'storageFile',
  'i18nDir',
] as const

export interface ExplainInput {
  config: Config
  /** 配置根相对路径（调用方负责把绝对路径归一） */
  paths: string[]
  enabled: Rule[]
  skipped: { rule: string; reason: string }[]
  /** 注入而不是 import：引擎不认识任何 pack，而「该放哪」的文案住在 pack 里 */
  placement?: (rel: string, config: Config) => string
  index?: RoleIndex
}

export function explainPaths(input: ExplainInput): PathExplanation[] {
  const { config } = input
  const index = input.index ?? buildRoleIndex(config)
  const enabled: ExplainRule[] = input.enabled.map((rule) => ({
    id: rule.id,
    title: rule.title,
    domain: rule.domain,
    level: rule.level,
    severity: rule.severity,
    ...(rule.hint ? { hint: rule.hint } : {}),
  }))
  const slots = [
    ...new Set(
      config.roles
        .map((role) => role.slot)
        .filter((slot): slot is string => typeof slot === 'string' && slot.length > 0),
    ),
  ]
  const pathParams: Record<string, string> = {}
  for (const key of PATH_PARAM_KEYS) {
    const value = config.params[key]
    if (typeof value === 'string' && value.length > 0) pathParams[key] = value
  }

  return input.paths.map((rel) => {
    const resolution = resolveRole(index, rel)
    const judged =
      resolution.status === 'matched' ||
      resolution.status === 'missing' ||
      resolution.status === 'ambiguous'
    const role =
      resolution.status === 'matched'
        ? {
            id: resolution.descriptor.id,
            layer: resolution.descriptor.layer,
            slot: resolution.descriptor.slot ?? null,
            domain: resolution.captured.domain ?? null,
            group:
              resolution.descriptor.group != null
                ? (resolution.captured[resolution.descriptor.group] ?? null)
                : null,
            groupName: resolution.descriptor.group ?? null,
          }
        : null

    const notes: string[] = []
    if (!exists(`${config.root}/${rel}`)) {
      notes.push('该路径当前不存在（还没写）—— 上面就是它的契约')
    }
    if (resolution.status === 'outside') {
      notes.push(
        `不在契约扫描域里（include: ${config.include.join(', ') || '(不限)'}）：不参与目录契约判定`,
      )
    }
    if (resolution.status === 'ignored') {
      notes.push('被 ignore 命中：完全不属于这个项目（不进文件集、不解析）')
    }
    if (resolution.status === 'vcs-ignored') {
      notes.push(
        '契约域外且被 .gitignore 忽略（git 判定）：连解析都不做 —— 想让它参与判定就把它移进契约域，或在 ignore 里显式声明',
      )
    }
    if (resolution.status === 'missing') {
      notes.push('无处安放：没有任何角色命中它 —— 按下面的槽位表选一个位置')
    }
    if (resolution.status === 'ambiguous') {
      notes.push(
        `歧义：同时命中 ${resolution.roles.length} 个角色（${resolution.roles.join(' / ')}）—— 角色表需要收窄`,
      )
    }
    if (resolution.status === 'resource') {
      notes.push('资源文件（json / html 等）：只进文件集供图解析，不参与角色判定')
    }

    return {
      path: rel,
      exists: exists(`${config.root}/${rel}`),
      status: resolution.status,
      judged,
      role,
      ambiguousRoles: resolution.status === 'ambiguous' ? resolution.roles : [],
      // 「该放哪」是**错位**提示：只有没落位的文件才需要它，正确落位的文件显示它会误导
      placement:
        resolution.status === 'missing' && input.placement ? input.placement(rel, config) : null,
      contract: {
        srcRoot: config.srcRoot,
        layout: config.layout,
        entries: config.entries,
        structure: config.structure,
        imports: importContract(config, role?.layer),
        slots,
      },
      naming: config.naming,
      pathParams,
      rules: { enabled, skipped: input.skipped },
      notes,
    }
  })
}

/** 从 `layout` + 结构声明派生"能依赖谁"（与 S04–S06 / S21–S23 是同一份配置事实） */
function importContract(config: Config, layer: number | undefined): string[] {
  const lines: string[] = []
  if (config.structure.order && layer !== undefined) {
    lines.push(`层序单向：只许依赖层号 ≤ ${layer} 的文件（S21）`)
  }
  const { modules, shared } = config.layout
  if (modules.length > 0 && shared.length > 0) {
    lines.push(`域内只许：./ 、@/${modules}/<自己> 、@/${shared}/ 、第三方包（S04）`)
    lines.push(`域外只许 @/${modules}/<域>/routes；views 对域外私有（S05 / S06）`)
  }
  if (config.structure.isolate.length > 0) {
    lines.push(`同 ${config.structure.isolate.join(' / ')} 维度的同层组之间不许互引（S22）`)
  }
  if (config.structure.publicApi.length > 0) {
    lines.push(
      `组必须有公开面入口（` + '`entry: true`' + ` 的角色），组外不许绕过它直引内部（S23）`,
    )
  }
  if (config.entries.length > 0) lines.push(`可达性入口：${config.entries.join(' , ')}`)
  return lines
}

const STATUS_LABEL: Record<RoleResolution['status'], string> = {
  matched: '命中角色',
  missing: '无处安放',
  ambiguous: '歧义',
  outside: '契约扫描域之外',
  'vcs-ignored': '契约域外 + 被 git 忽略',
  ignored: '被 ignore',
  resource: '资源文件',
}

export function renderExplanations(list: PathExplanation[], format: ReportFormat): string {
  if (format === 'json') return JSON.stringify(list, null, 2)
  const blocks = list.map((item) => {
    const lines: string[] = [`${item.path}`, `  状态       ${STATUS_LABEL[item.status]}`]
    if (!item.judged) {
      for (const note of item.notes) lines.push(`  提示       ${note}`)
      return lines.join('\n')
    }
    if (item.role) {
      const parts = [`${item.role.id}`, `层 ${item.role.layer}`]
      if (item.role.slot) parts.push(`槽位 ${item.role.slot}`)
      if (item.role.domain) parts.push(`域 ${item.role.domain}`)
      if (item.role.group) parts.push(`组 ${item.role.group}（维度 ${item.role.groupName}）`)
      lines.push(`  角色       ${parts.join(' · ')}`)
    }
    if (item.placement) lines.push(`  该放哪     ${item.placement}`)
    if (item.contract.imports.length > 0) {
      lines.push(`  依赖       ${item.contract.imports[0]}`)
      for (const extra of item.contract.imports.slice(1)) lines.push(`             ${extra}`)
    }
    lines.push(
      `  命名       hook 前缀 \`${item.naming.hookPrefix}\` · 页面后缀 \`${item.naming.viewSuffix}\``,
    )
    const params = Object.entries(item.pathParams)
    if (params.length > 0) {
      lines.push(`  落点参数   ${params.map(([key, value]) => `${key}=${value}`).join(' · ')}`)
    }
    if (item.contract.slots.length > 0) {
      lines.push(`  合法槽位   ${item.contract.slots.join(' / ')}`)
    }
    const byDomain = new Map<string, ExplainRule[]>()
    for (const rule of item.rules.enabled) {
      const bucket = byDomain.get(rule.domain) ?? []
      bucket.push(rule)
      byDomain.set(rule.domain, bucket)
    }
    lines.push(
      `  启用规则   ${item.rules.enabled.length} 条（` +
        [...byDomain]
          .map(
            ([domain, rules]) =>
              `${DOMAIN_LABEL[domain as keyof typeof DOMAIN_LABEL] ?? domain} ${rules.length}`,
          )
          .join(' · ') +
        '）',
    )
    for (const [domain, rules] of byDomain) {
      lines.push(`             ${DOMAIN_LABEL[domain as keyof typeof DOMAIN_LABEL] ?? domain}：`)
      for (const rule of rules) {
        lines.push(`               ${rule.id} ${rule.title}${rule.hint ? ` —— ${rule.hint}` : ''}`)
      }
    }
    if (item.rules.skipped.length > 0) {
      lines.push(
        `  因能力停用 ${item.rules.skipped.map((entry) => entry.rule).join(' / ')}（缺能力，不是通过）`,
      )
    }
    for (const note of item.notes) lines.push(`  提示       ${note}`)
    return lines.join('\n')
  })
  return blocks.join('\n\n')
}
