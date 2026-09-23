import { execFileSync } from 'node:child_process'
import { realpathSync, writeFileSync } from 'node:fs'
import { aggregate, readCoverageReport, type CoverageReport } from './coverage.js'
import { join, relative } from 'node:path'

import { applyBaseline, entriesFromFindings, loadBaseline, saveBaseline } from './baseline.js'
import { loadConfig } from './config.js'
import { depsPolicyFrom, policyConflicts, readProjectDeps } from './deps.js'
import { wheelFingerprints } from '../data/wheel-fingerprints.js'
import { extractFacts, factInputOf } from './facts.js'
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
import type { Config, Domain, Facts, Finding, Level, Rule, RuleContext, Severity } from './types.js'
import { globToRegExp, readText } from './util.js'

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
  rules: Rule[]
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
  config: Config
  all: Finding[]
  active: Finding[]
  scope: string
  scopeFiles: string[]
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

/** 最近一次提交的时间（M06 用来判「覆盖率产物是不是过期的」）；没有 git 或没有提交时返回 null */
function gitHeadTimeMs(root: string): number | null {
  try {
    const seconds = execFileSync('git', ['-C', root, 'log', '-1', '--format=%ct'], {
      encoding: 'utf8',
    }).trim()
    const value = Number.parseInt(seconds, 10)
    return Number.isFinite(value) ? value * 1000 : null
  } catch {
    return null
  }
}

/**
 * `--paths` 的模式归一：绝对路径（含绝对 glob）换算成配置根相对路径；相对模式原样返回。
 *
 * 为什么要它：诊断/编辑器插件按文件传参时给绝对路径，而报告里的路径都是配置根相对的；
 * 不换算就会全部过滤掉 —— 那是「假绿」，比报错危险。
 */
export function rootRelativePattern(pattern: string, root: string): string {
  if (!pattern.startsWith('/')) return pattern
  const real = (path: string): string => {
    try {
      return realpathSync(path)
    } catch {
      return path
    }
  }
  const realRoot = real(root)
  // 常见形态一：绝对路径直接以配置根开头（含 glob 也适用，因为是纯字符串剥离）
  if (pattern === root) return ''
  if (pattern.startsWith(`${root}/`)) return pattern.slice(root.length + 1)
  if (pattern.startsWith(`${realRoot}/`)) return pattern.slice(realRoot.length + 1)
  // 形态二：软链写法不同（/var vs /private/var）→ 只对通配符之前的前缀做 realpath 后算相对
  const literal = pattern.replace(/[?*[\]].*$/, '')
  const tail = pattern.slice(literal.length)
  return `${relative(realRoot, real(literal)).split('\\').join('/')}${tail}`
}

/** git 变更集：untracked 必须纳入，rename 按改名处理（见 docs/DESIGN.md §6.8） */
function gitChangedFiles(root: string, scope: string): { files: string[]; notice?: string } | null {
  const git = (args: string[]): string[] =>
    execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' })
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
  try {
    // 变更路径是相对**仓库根**的；配置根可能不是仓库根，必须换算，否则会路径对不上而假绿
    const top = execFileSync('git', ['-C', root, 'rev-parse', '--show-toplevel'], {
      encoding: 'utf8',
    }).trim()
    let raw: string[]
    if (scope === 'staged') raw = git(['diff', '--cached', '--name-only', '--find-renames', 'HEAD'])
    else if (scope === 'changed') {
      raw = [
        ...git(['diff', '--name-only', '--find-renames', 'HEAD']),
        ...git(['ls-files', '--others', '--exclude-standard']),
      ]
    } else if (scope.startsWith('since:')) {
      raw = git(['diff', '--name-only', '--find-renames', `${scope.slice('since:'.length)}...HEAD`])
    } else {
      return null
    }
    // macOS 上 /var 与 /private/var 是同一目录的两种写法（CI 容器里也常见 /tmp 软链）：
    // 不先 realpath 就做 relative 会算出 `../../..`，变更路径与文件全都对不上 → **假绿**。
    const real = (path: string): string => {
      try {
        return realpathSync(path)
      } catch {
        return path
      }
    }
    const realRoot = real(root)
    const realTop = real(top)
    const files = raw.map((path) =>
      relative(realRoot, real(join(realTop, path)))
        .split('\\')
        .join('/'),
    )
    return realTop === realRoot
      ? { files }
      : { files, notice: `仓库根是 ${top}，变更路径已换算到配置根` }
  } catch {
    return null
  }
}

export async function runGuard(options: RunOptions): Promise<RunResult> {
  const started = Date.now()
  const quiet = options.quiet === true
  const notices: string[] = []

  const { config, notices: configNotices } = await loadConfig({
    root: options.cwd,
    ...(options.configPath ? { configPath: options.configPath } : {}),
  })
  notices.push(...configNotices)

  const scan = scanProject(config)
  const texts = new Map<string, string>()
  const facts = new Map<string, Facts>()
  const cssTexts = new Map<string, string>()

  for (const record of scan.records) {
    try {
      const text = readText(record.abs)
      texts.set(record.rel, text)
      if (record.kind === 'ts') facts.set(record.rel, extractFacts(factInputOf(record, text)))
      else if (record.kind === 'css') cssTexts.set(record.rel, text)
    } catch (error) {
      notices.push(`读取失败：${record.rel}（${(error as Error).message}）`)
    }
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

  const registry = createRegistry(options.rules, config, {
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

  /* ---- scope 提前算：M05（变更文件必须被覆盖）要用同一份变更集，后面报告过滤复用 ---- */
  const scope = options.scope ?? 'full'
  const changed = scope === 'full' ? null : gitChangedFiles(config.root, scope)

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
    git: { changedFiles: changed?.files ?? null, headTimeMs: gitHeadTimeMs(config.root) },
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
  const ruleIndex = new Map(options.rules.map((rule) => [rule.id, rule]))
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

  /* ---- scope 过滤：只过滤报告，不过滤正确性 ---- */
  let scopeFiles: string[] = []
  if (scope !== 'full') {
    if (changed === null) {
      notices.push(`scope=${scope} 无法取得 git 变更集（无 git 或无提交），已降级为全量`)
    } else {
      if (changed.notice) notices.push(changed.notice)
      scopeFiles = changed.files
      const set = new Set(changed.files)
      active = active.filter((finding) => {
        if (set.has(finding.file)) return true
        if (finding.global) return options.localOnly !== true
        return false
      })
    }
  }
  const globalFindings = active.filter((finding) => finding.global).length

  if (options.paths && options.paths.length > 0) {
    // `--paths` 同时接受配置根相对路径与**绝对路径**：IDE / 编辑器插件 / lint 工具按文件传参时
    // 给的是绝对路径，不归一就会「一条都没匹配上」→ 静默假绿（门禁报通过，其实什么都没查）。
    const matchers = options.paths.map((pattern) =>
      globToRegExp(rootRelativePattern(pattern, config.root)),
    )
    const globalsBefore = active.filter((finding) => finding.global).length
    active = active.filter((finding) => matchers.some((matcher) => matcher.test(finding.file)))
    const globalsAfter = active.filter((finding) => finding.global).length
    if (globalsBefore > globalsAfter) {
      notices.push(
        `--paths 只报匹配的文件：本次另有 ${globalsBefore - globalsAfter} 条全局违规（架构级）被过滤，需全量运行才可见`,
      )
    }
  }
  if (options.severity) {
    active = active.filter((finding) => severityOf(finding, ruleIndex) === options.severity)
  }

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
    durationMs: Date.now() - started,
    rulesEnabled: registry.enabled.length,
    rulesTotal: options.rules.length,
    exemptedFiles: scan.exempted.length,
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
    all,
    active,
    scope,
    scopeFiles,
    durationMs: Date.now() - started,
    stats,
  }
}
