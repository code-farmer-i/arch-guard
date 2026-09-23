import { execFileSync } from 'node:child_process'
import { join, relative, resolve } from 'node:path'

import { applyBaseline, entriesFromFindings, loadBaseline, saveBaseline } from './baseline.js'
import { loadConfig } from './config.js'
import { depsPolicyFrom, policyConflicts, readProjectDeps } from './deps.js'
import { wheelFingerprints } from '../data/wheel-fingerprints.js'
import { extractFacts, factInputOf } from './facts.js'
import { buildGraph } from './graph.js'
import { json } from './output.js'
import { createRegistry } from './registry.js'
import {
  renderReport,
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
  rules: Rule[]
  quiet?: boolean
}

export interface RunResult {
  exitCode: number
  config: Config
  all: Finding[]
  active: Finding[]
  scope: string
  scopeFiles: string[]
  durationMs: number
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
    const files = raw.map((path) => relative(root, join(top, path)).split('\\').join('/'))
    return top === resolve(root)
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
  const deps = readProjectDeps(config.root, graph.externals.keys())

  const registry = createRegistry(options.rules, config, {
    ...(options.only ? { only: options.only } : {}),
    ...(options.domain ? { domain: options.domain } : {}),
    ...(options.minLevel ? { minLevel: options.minLevel } : {}),
  })

  const ctx: RuleContext = {
    config,
    records: scan.records,
    facts,
    graph,
    scan,
    deps,
    policy,
    files: scan.files,
    sourceOf,
  }

  const all: Finding[] = []
  for (const rule of registry.enabled) {
    try {
      for (const finding of rule.run(ctx)) all.push(finding)
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
  const scope = options.scope ?? 'full'
  let scopeFiles: string[] = []
  if (scope !== 'full') {
    const changed = gitChangedFiles(config.root, scope)
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
    const matchers = options.paths.map(globToRegExp)
    active = active.filter((finding) => matchers.some((matcher) => matcher.test(finding.file)))
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
    } else {
      renderReport(reportInput)
      renderSummary(reportInput)
    }
  }

  const errors = active.filter((finding) => severityOf(finding, ruleIndex) !== 'warn').length
  const exitCode = options.reportOnly === true ? 0 : errors > 0 ? 1 : 0

  return { exitCode, config, all, active, scope, scopeFiles, durationMs: Date.now() - started }
}
