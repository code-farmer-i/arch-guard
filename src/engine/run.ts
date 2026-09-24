import { writeFileSync } from 'node:fs'
import { aggregate, readCoverageReport, type CoverageReport } from './coverage.js'
import { join, relative } from 'node:path'

import { applyBaseline, entriesFromFindings, loadBaseline, saveBaseline } from './baseline.js'
import { loadConfig } from './config.js'
import { depsPolicyFrom, policyConflicts, readProjectDeps } from './deps.js'
import { wheelFingerprints } from '../data/wheel-fingerprints.js'
import { extractFacts, factInputOf } from './facts.js'
import { disabledFactsCache, openFactsCache } from './facts-cache.js'
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
  type ReportInput,
} from './report.js'
import { scanProject } from './scan.js'
import type { Pack } from './pack.js'
import type { Config, Domain, Facts, Finding, Level, Rule, RuleContext, Severity } from './types.js'
import { applyReportFilters } from './filters.js'
import { gitChangedFiles, gitHeadTimeMs, stagedContentsOf } from './git.js'
import { readText } from './util.js'

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
  updateBaseline?: boolean
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

  const scan = scanProject(config)
  // 收窄扫描域是行为变更（域外文件不再报 S01），必须自述 —— 不许静默
  if (config.include.length > 0) {
    notices.push(
      `契约扫描域 ${config.include.join(' , ')}：域外 ${scan.outside.length} 个 ts/css 不参与目录契约判定（仍在依赖图里）`,
    )
  } else if (scan.records.length === 0) {
    // include 不限（引擎默认）且全树 0 个源码：没有任何东西被判定，必须说出来。
    // include 非空的情况由 S24 报错（那是配置写错，不是空仓库）。
    notices.push('include 未限制，但全项目 0 个 ts/css 文件：本次没有任何东西被判定')
  }
  const texts = new Map<string, string>()
  const facts = new Map<string, Facts>()
  const cssTexts = new Map<string, string>()

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

  // facts 缓存：解析结果只由「文件内容 + rel + role」决定，可以跨进程复用（见 facts-cache.ts）
  const cache =
    options.cache === false
      ? disabledFactsCache()
      : openFactsCache(config.root, (m) => notices.push(m))

  // 契约域内的文件 + 域外文件（角色 `(outside)`）都要解析：
  // 前者判定用，后者只为依赖图完整（测试作为可达根、跨域 import 边）。
  for (const record of [...scan.records, ...scan.outside]) {
    try {
      // staged 的内容取自 index（pre-commit 检查的是"将提交的东西"，不是工作区）
      const text = staged?.contents.get(record.rel) ?? readText(record.abs)
      texts.set(record.rel, text)
      if (record.kind === 'ts') {
        const cached = cache.get(record, text)
        if (cached) {
          // 绝对路径不进缓存语义（换机器/换目录后必须刷新），其余字段都由内容决定
          cached.file = record.abs
          facts.set(record.rel, cached)
        } else {
          const extracted = extractFacts(factInputOf(record, text))
          facts.set(record.rel, extracted)
          cache.set(record, text, extracted)
        }
      } else if (record.kind === 'css') cssTexts.set(record.rel, text)
    } catch (error) {
      notices.push(`读取失败：${record.rel}（${(error as Error).message}）`)
    }
  }
  cache.save()
  const cacheStats = cache.stats()
  if (options.cache !== false && cacheStats.hits + cacheStats.misses > 0) {
    // 命中数必须自述：不然「缓存到底有没有生效、写在哪」只能靠猜
    const where = cacheStats.path === null ? '(未落盘)' : relative(config.root, cacheStats.path)
    notices.push(
      `facts 缓存 ${where}：命中 ${cacheStats.hits}/${cacheStats.hits + cacheStats.misses}` +
        (cacheStats.hits > 0 ? '（省下的就是解析）' : '（首次或缓存作废，本轮全量解析）'),
    )
  }

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

  /* ---- 棘轮 ---- */
  const baselinePath = join(config.root, config.baselineFile)
  const fullScope = (options.scope ?? 'full') === 'full'
  let active: Finding[]
  let exemptedCount = 0
  let unusedBaseline: ReportInput['unusedBaseline'] = []

  if (options.updateBaseline) {
    if (!fullScope) {
      throw new Error('--update-baseline 只能在全量 scope 下运行（增量会写出不完整的基线）')
    }
    const entries = entriesFromFindings(all, sourceOf)
    saveBaseline(baselinePath, entries)
    notices.push(`已写入基线 ${config.baselineFile}：${entries.length} 条`)
    // 覆盖率棘轮的快照一并写下（同一个命令，避免两处手动维护）
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
    }
    active = []
  } else {
    const baseline = loadBaseline(baselinePath)
    const split = applyBaseline(all, baseline, sourceOf)
    active = split.active
    exemptedCount = split.exempted.length
    // 过期豁免只在全量模式检查（增量运行不该刷过期噪音）
    unusedBaseline = fullScope ? split.unused : []
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
    exemptedCount,
    unusedBaseline,
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
    exemptedFiles: scan.exempted.length,
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
    cache: { hits: cacheStats.hits, misses: cacheStats.misses },
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
