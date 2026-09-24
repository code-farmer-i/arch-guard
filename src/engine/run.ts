import { writeFileSync } from 'node:fs'
import { aggregate, readCoverageReport, type CoverageReport } from './coverage.js'
import { join } from 'node:path'

import { loadConfig } from './config.js'
import { depsPolicyFrom, policyConflicts, readProjectDeps } from './deps.js'
import { wheelFingerprints } from '../data/wheel-fingerprints.js'
import { collectSources } from './collect.js'
import { buildGraph } from './graph.js'
import { collectI18n } from './i18n.js'
import { json, out } from './output.js'
import { createRegistry } from './registry.js'
import {
  renderGithubAnnotations,
  renderReport,
  renderStats,
  renderSummary,
  severityOf,
  toJsonReport,
  type ExceptionReport,
  type ReportInput,
} from './report.js'
import { scanProject } from './scan.js'
import type { Pack } from './pack.js'
import type { Config, Domain, Finding, Level, Rule, RuleContext, Severity } from './types.js'
import { applyReportFilters } from './filters.js'
import { gitChangedFiles, gitHeadTimeMs, gitIgnoredPaths, stagedContentsOf } from './git.js'
import { exists, globToRegExp } from './util.js'

export type ScopeMode = 'full' | 'changed' | 'staged' | `since:${string}`

export interface RunOptions {
  cwd: string
  configPath?: string
  scope?: string
  paths?: string[]
  domain?: Domain[]
  only?: string[]
  minLevel?: Level
  severity?: Severity
  /** 只刷新覆盖率棘轮快照（M04）；与「豁免违规」无关 —— 违规没有豁免渠道 */
  updateCoverage?: boolean
  reportOnly?: boolean
  localOnly?: boolean
  format?: 'pretty' | 'json' | 'github'
  /** 打印每条规则的耗时与命中（排查「为什么这么慢」） */
  stats?: boolean
  /** 覆盖率产物路径（覆盖 metrics 适配器里的配置；门禁只读它，不跑测试） */
  coverageReport?: string
  /**
   * 规则集。给了就直接用（程序化调用 / 单测）；不给就从配置的框架包取。
   * CLI 走的是后者：规则集由 `packs` 决定，不再是硬编码数组。
   */
  rules?: Rule[]
  /** 调用方（CLI）能提供的框架包：配置里没写 `packs` 时用它兜底 */
  fallbackPacks?: Pack[]
  /** facts 持久缓存（默认开）；`false` = 每轮全量解析 */
  cache?: boolean
  quiet?: boolean
}

/** 单条规则的执行统计（--stats 用） */
export interface RuleStat {
  rule: string
  domain: string
  ms: number
  hits: number
}

export interface RunResult {
  exitCode: number
  /** facts 缓存命中情况（`cache: false` 时恒为 0/文件数） */
  cache: { hits: number; misses: number }
  config: Config
  all: Finding[]
  active: Finding[]
  scope: string
  scopeFiles: string[]
  /** `--local-only` 跳过的全局违规条数（0 = 没跳过；程序化调用方也拿得到这个事实） */
  skippedGlobals: number
  /** `--severity` 过滤掉的 finding 条数（0 = 没过滤；同理不许静默） */
  filteredBySeverity: number
  durationMs: number
  stats: RuleStat[]
}

/** 覆盖率总览（棘轮快照写的就是这三个数） */
function coverageTotals(report: CoverageReport): {
  lines: number
  branches: number
  functions: number
} {
  const stats = aggregate(report, () => true)
  return {
    lines: stats?.lines ?? 0,
    branches: stats?.branches ?? 0,
    functions: stats?.functions ?? 0,
  }
}

export async function runGuard(options: RunOptions): Promise<RunResult> {
  const started = Date.now()
  const quiet = options.quiet === true
  const notices: string[] = []

  const {
    config,
    notices: configNotices,
    packs,
  } = await loadConfig({
    root: options.cwd,
    ...(options.configPath ? { configPath: options.configPath } : {}),
    ...(options.fallbackPacks ? { fallbackPacks: options.fallbackPacks } : {}),
  })
  notices.push(...configNotices)

  // 规则集：显式给的优先；否则由框架包决定（换 pack = 换整套规则，见 PARADIGM §11）
  const rules = options.rules ?? packs.flatMap((pack) => pack.rules)
  if (rules.length === 0) {
    throw new Error(
      '没有任何可跑的规则：配置里没有框架包，调用方也没给 rules\n' +
        '（在 arch.config.mjs 里写 packs: [tsPack] 或 [reactPack]，或让调用方传 fallbackPacks）',
    )
  }

  // git 判定「不在仓库里」的路径（.gitignore / info/exclude / 全局）：
  // **作为基础**叠加在宿主显式 `ignore` 之上，只作用于契约域外；取不到 git 就整层降级关闭。
  const vcsIgnored = gitIgnoredPaths(config.root)
  const scan = scanProject(config, vcsIgnored ? { vcsIgnored } : {})
  // 收窄扫描域是行为变更（域外文件不再报 S01），必须自述 —— 不许静默
  if (config.include.length > 0) {
    notices.push(
      `契约扫描域 ${config.include.join(' , ')}：域外 ${scan.outside.length} 个 ts/css 不参与目录契约判定（仍在依赖图里）`,
    )
  } else if (scan.records.length === 0) {
    // 走到这里说明 include 不限（引擎默认）；下面还会单独说 ignore 的跳过数
    // include 不限（引擎默认）且全树 0 个源码：没有任何东西被判定，必须说出来。
    // include 非空的情况由 S24 报错（那是配置写错，不是空仓库）。
    notices.push('include 未限制，但全项目 0 个 ts/css 文件：本次没有任何东西被判定')
  }
  /* ---- scope 提前算：`staged` 要影响**读哪份内容**（index blob vs 工作区），所以必须在解析之前 ---- */
  const scope = options.scope ?? 'full'
  const changed = scope === 'full' ? null : gitChangedFiles(config.root, scope)
  const scanned = new Set([...scan.records, ...scan.outside].map((record) => record.rel))
  const staged =
    scope === 'staged' && changed !== null
      ? // 只向 git 要会被解析的文件：变更集里可能有图片等非源码，读它们的 blob 没意义
        stagedContentsOf(
          config.root,
          changed.files.filter((rel) => scanned.has(rel)),
        )
      : null
  if (staged && staged.missing.length > 0) {
    notices.push(
      `staged：${staged.missing.length} 个文件取不到 index 内容（staged 删除或 git 报错），已退回工作区内容：${staged.missing.slice(0, 5).join(' , ')}${staged.missing.length > 5 ? ' …' : ''}`,
    )
  }

  // 阈值 `viewLines` 只对**页面级**角色生效（`pageLike` / `views` 槽位）：本范式没有这类角色时
  // 它**永远不会生效** —— 配了却没效果正是本仓最忌讳的静默失效，所以当场自述（D21 同款套路）
  if (
    config.thresholds.viewLines !== config.thresholds.fileLines &&
    !config.roles.some((role) => role.pageLike === true || role.slot === 'views')
  ) {
    notices.push(
      `阈值 viewLines=${config.thresholds.viewLines} 已设，但本范式没有页面级角色（pageLike / views 槽位）：这条阈值不会生效`,
    )
  }

  // `ignore`（项目边界）跳过了什么必须自述：它是"别碰"，被跳过的东西**不进文件集、不解析、不进图**，
  // 而报告此前完全不提它 —— 宿主把某个源码目录误写进 ignore 时，表现就是"悄无声息地不判了"
  if (scan.vcsIgnored.length > 0) {
    notices.push(
      `因 .gitignore（git 判定）跳过 ${scan.vcsIgnored.length} 个文件：契约域外、不进文件集也不解析`,
    )
  }
  if (scan.ignored.length > 0) {
    notices.push(
      `ignore（项目边界）命中 ${scan.ignored.length} 个文件，未进文件集也不解析：${config.ignore.join(' , ')}`,
    )
  }

  // 读源码 → 提事实 → 缓存（见 collect.ts：契约域内 + 域外都要解析，staged 取 index 内容）
  const collected = collectSources({
    config,
    records: scan.records,
    outside: scan.outside,
    staged: staged ? staged.contents : null,
    useCache: options.cache !== false,
    notice: (message) => notices.push(message),
  })
  const { texts, facts, cssTexts } = collected

  const graph = buildGraph({ config, files: scan.files, facts, cssTexts })
  const sourceOf = (rel: string): string | undefined => texts.get(rel)

  // 依赖策略：自相矛盾必须报错（不许默默按某一侧生效）
  const policy = depsPolicyFrom(config.params)
  const platformCapabilities = wheelFingerprints
    .filter((entry) => entry.platform === true)
    .map((entry) => entry.capability)
  const conflicts = policyConflicts(policy, platformCapabilities)
  if (conflicts.length > 0) {
    throw new Error(`依赖策略自相矛盾：\n  - ${conflicts.join('\n  - ')}`)
  }
  // 能力表不再隐式开启 P01：把这条语义显式说出来，避免用户以为还处在「未登记即拒」模式
  if (policy.allow.length === 0 && Object.keys(policy.capabilities).length > 0) {
    notices.push(
      '能力表只驱动 P06（手搓指纹），本次未开启 P01 依赖白名单；要「未登记即拒」请显式写 deps({ allow: [...] })',
    )
  }
  const deps = readProjectDeps(config.root, graph.externals.keys())

  const registry = createRegistry(rules, config, {
    ...(options.only ? { only: options.only } : {}),
    ...(options.domain ? { domain: options.domain } : {}),
    ...(options.minLevel ? { minLevel: options.minLevel } : {}),
  })

  const i18n = collectI18n({
    records: scan.records,
    sourceOf,
    resourceDir: String(
      (config.adapters.i18n as { resourceDir?: string } | undefined)?.resourceDir ?? '',
    ),
  })

  /* ---- 度量产物：门禁只读，不跑测试；读不到就交给 M06 fail-closed ---- */
  const metricsAdapter = config.adapters.metrics as
    | {
        coverage?: {
          report?: string
          ratchet?: boolean
          baselineFile?: string
          pathRewrite?: [string, string][]
        }
      }
    | undefined
  const reportPath = options.coverageReport ?? metricsAdapter?.coverage?.report
  let metricsInfo: RuleContext['metrics']
  if (reportPath) {
    const abs = join(config.root, reportPath)
    try {
      const report = readCoverageReport(abs, config.root)
      for (const [pattern, replacement] of metricsAdapter?.coverage?.pathRewrite ?? []) {
        const matcher = new RegExp(pattern)
        for (const file of report.files) file.rel = file.rel.replace(matcher, replacement)
      }
      metricsInfo = { reportPath, report }
    } catch (error) {
      metricsInfo = { reportPath, report: null, error: (error as Error).message }
    }
  }

  const ctx: RuleContext = {
    config,
    records: scan.records,
    facts,
    i18n,
    ...(metricsInfo ? { metrics: metricsInfo } : {}),
    git: {
      changedFiles: changed?.files ?? null,
      // 只有 metrics 域（M06 判覆盖率产物是否过期）会读 headTimeMs。
      // 没有 metrics 适配器时就不该起 git 子进程：省一次 spawn，也避免在没有 git 的目录里
      // 把 git 自己的「致命错误」打到用户的 stderr 上（execFileSync 的 stderr 默认透传）。
      headTimeMs: metricsInfo ? gitHeadTimeMs(config.root) : null,
    },
    graph,
    scan,
    deps,
    policy,
    files: scan.files,
    sourceOf,
  }

  const all: Finding[] = []
  const stats: RuleStat[] = []
  for (const rule of registry.enabled) {
    const startedAt = performance.now()
    try {
      let hits = 0
      for (const finding of rule.run(ctx)) {
        all.push(finding)
        hits += 1
      }
      stats.push({ rule: rule.id, domain: rule.domain, ms: performance.now() - startedAt, hits })
    } catch (error) {
      // fail closed：规则自身异常绝不能静默通过
      all.push({
        rule: rule.id,
        file: '(engine)',
        line: 1,
        text: `规则执行异常：${(error as Error).message}`,
        hint: '这是引擎缺陷或规则实现问题，不是项目代码问题',
        global: true,
      })
      stats.push({ rule: rule.id, domain: rule.domain, ms: performance.now() - startedAt, hits: 1 })
    }
  }
  const ruleIndex = new Map(rules.map((rule) => [rule.id, rule]))
  all.sort(
    (a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.rule.localeCompare(b.rule),
  )

  /* ---- 规则级例外：只摘掉「指名的那条规则 × 那些文件」的发现项 ---- */
  // 关键：这是对**发现项**的后置过滤，不是扫描期的整文件跳过 ——
  // 文件照常有角色、进依赖图、被其它规则判定（曾经的文件级 exempt 会让整个文件失能）。
  const exceptionHits = config.exceptions.map(() => 0)
  if (config.exceptions.length > 0) {
    const knownRules = new Set(rules.map((rule) => rule.id))
    const today = new Date().toISOString().slice(0, 10)
    for (const entry of config.exceptions) {
      // fail-closed：拼错的规则 id 等于例外根本没生效（假绿），必须当场报
      if (!knownRules.has(entry.rule)) {
        throw new Error(
          `exceptions 引用了不存在的规则：${entry.rule}（${entry.glob}）—— 拼错等于没写，必须报出来`,
        )
      }
      if (entry.expires !== undefined && entry.expires < today) {
        throw new Error(
          `exceptions 已过期：${entry.rule} × ${entry.glob}（expires ${entry.expires}，今天 ${today}）—— 续期或删掉它`,
        )
      }
    }
    const matchers = config.exceptions.map((entry) => globToRegExp(entry.glob))
    const kept: Finding[] = []
    for (const finding of all) {
      const hit = config.exceptions.findIndex(
        (entry, index) =>
          entry.rule === finding.rule && (matchers[index] as RegExp).test(finding.file),
      )
      if (hit >= 0) {
        exceptionHits[hit] = (exceptionHits[hit] ?? 0) + 1
        continue
      }
      kept.push(finding)
    }
    all.splice(0, all.length, ...kept)
  }
  const exceptions: ExceptionReport[] = config.exceptions.map((entry, index) => ({
    ...entry,
    hits: exceptionHits[index] ?? 0,
  }))

  /* ---- 违规**没有**存量豁免：全量违规直接进报告，active 就是全部 ---- */
  let active: Finding[] = all

  // 覆盖率棘轮快照（M04 用）：这是"覆盖率不许倒退"的基线，与"豁免违规"是两件事
  if (options.updateCoverage) {
    const coverage = metricsAdapter?.coverage
    if (coverage?.ratchet === true && metricsInfo?.report) {
      const totals = coverageTotals(metricsInfo.report)
      writeFileSync(
        join(config.root, coverage.baselineFile ?? 'arch.coverage.json'),
        `${JSON.stringify({ specVersion: '1', files: metricsInfo.report.files.length, ...totals }, null, 2)}\n`,
        'utf8',
      )
      notices.push(
        `已写入覆盖率快照：行 ${totals.lines.toFixed(2)}% / 分支 ${totals.branches.toFixed(2)}%`,
      )
    } else {
      notices.push(
        '--update-coverage：没启用覆盖率棘轮（metrics 的 coverage.ratchet）或覆盖率产物读不到，未写快照',
      )
    }
  }

  // 旧机制留下的文件：不再豁免任何东西 —— 明说，免得以为存量债还挂着
  if (exists(join(config.root, 'arch.baseline.json'))) {
    notices.push(
      '检测到 arch.baseline.json：违规基线机制已移除，存量违规不再被豁免（请删除该文件）',
    )
  }

  /* ---- 报告过滤（scope / --paths / --severity）：集中在一处，规矩是"只过滤报告且必须自述" ---- */
  const filtered = applyReportFilters({
    active,
    changed,
    scope,
    scanned,
    root: config.root,
    ruleIndex,
    notices,
    ...(options.paths ? { paths: options.paths } : {}),
    ...(options.severity ? { severity: options.severity } : {}),
    ...(options.localOnly ? { localOnly: true } : {}),
  })
  active = filtered.active
  const { scopeFiles, skippedGlobals, filteredBySeverity } = filtered
  const globalFindings = active.filter((finding) => finding.global).length

  const reportInput: ReportInput = {
    config,
    ruleIndex,
    findings: active,
    skipped: registry.skipped,
    unknownEnabled: registry.unknownEnabled,
    notices,
    scope,
    scopeFiles: scopeFiles.length,
    globalFindings,
    skippedGlobals,
    filteredBySeverity,
    durationMs: Date.now() - started,
    rulesEnabled: registry.enabled.length,
    rulesTotal: rules.length,
    exceptions,
    contractScope: config.include,
    outsideContract: scan.outside.length,
  }

  if (!quiet) {
    if (options.format === 'json') {
      json(toJsonReport(reportInput))
    } else if (options.format === 'github') {
      // 注解交给 CI 渲染；摘要仍走 stdout 便于人看
      const annotations = renderGithubAnnotations(reportInput)
      if (annotations) out(annotations)
      renderSummary(reportInput)
    } else {
      renderReport(reportInput)
      renderSummary(reportInput)
    }
    if (options.stats) out(renderStats(reportInput, stats))
  }

  const errors = active.filter((finding) => severityOf(finding, ruleIndex) !== 'warn').length
  const exitCode = options.reportOnly === true ? 0 : errors > 0 ? 1 : 0

  return {
    exitCode,
    config,
    cache: { hits: collected.cacheHits, misses: collected.cacheMisses },
    all,
    active,
    scope,
    scopeFiles,
    skippedGlobals,
    filteredBySeverity,
    durationMs: Date.now() - started,
    stats,
  }
}
