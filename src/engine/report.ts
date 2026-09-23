import type { BaselineEntry } from './baseline.js'
import { out } from './output.js'
import type { Config, Domain, Finding, Level, Rule, Severity } from './types.js'
import { color } from './util.js'

export interface ReportInput {
  config: Config
  ruleIndex: Map<string, Rule>
  findings: Finding[]
  exemptedCount: number
  unusedBaseline: BaselineEntry[]
  skipped: { rule: string; reason: string }[]
  unknownEnabled: string[]
  notices: string[]
  scope: string
  scopeFiles: number
  globalFindings: number
  durationMs: number
  rulesEnabled: number
  rulesTotal: number
  /** 配置里 exempt 掉的文件数（豁免必须可见） */
  exemptedFiles: number
}

const DOMAIN_LABEL: Record<Domain, string> = {
  structure: '结构',
  design: '设计系统',
  copy: '文案',
  deps: '依赖',
  hygiene: '反退化',
  metrics: '度量',
}

export function severityOf(finding: Finding, ruleIndex: Map<string, Rule>): Severity {
  return ruleIndex.get(finding.rule)?.severity ?? 'error'
}

export function summarize(
  findings: Finding[],
  ruleIndex: Map<string, Rule>,
): { errors: number; warnings: number } {
  let errors = 0
  let warnings = 0
  for (const finding of findings) {
    if (severityOf(finding, ruleIndex) === 'warn') warnings += 1
    else errors += 1
  }
  return { errors, warnings }
}

export function renderReport(input: ReportInput): void {
  const { findings, ruleIndex } = input
  const byDomain = new Map<Domain, Finding[]>()
  for (const finding of findings) {
    const domain = ruleIndex.get(finding.rule)?.domain ?? 'structure'
    const list = byDomain.get(domain) ?? []
    list.push(finding)
    byDomain.set(domain, list)
  }

  for (const [domain, list] of [...byDomain.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    out(color.bold(`\n${DOMAIN_LABEL[domain] ?? domain}（${list.length}）`))
    const ordered = [...list].sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)
    for (const finding of ordered) {
      const severity = severityOf(finding, ruleIndex)
      const badge = severity === 'warn' ? color.yellow('warn ') : color.red('error')
      const mark = finding.global ? color.dim('（全局）') : ''
      out(
        `  ${badge} ${finding.file}:${finding.line} ${color.cyan(`[${finding.rule}]`)} ${finding.text}${mark}`,
      )
      if (finding.hint) out(color.dim(`        → ${finding.hint}`))
    }
  }

  if (input.unusedBaseline.length > 0) {
    out(
      color.yellow(
        `\n⚠ 基线里有 ${input.unusedBaseline.length} 条已失效的豁免（代码已改或已修好），请删掉`,
      ),
    )
  }
  if (input.skipped.length > 0) {
    out(
      color.dim(
        `\n因能力未声明而停用 ${input.skipped.length} 条规则：${input.skipped.map((entry) => entry.rule).join(' / ')}`,
      ),
    )
  }
  if (input.unknownEnabled.length > 0) {
    out(color.yellow(`⚠ 配置里启用了不存在的规则：${input.unknownEnabled.join(', ')}`))
  }
  for (const notice of input.notices) out(color.dim(`· ${notice}`))
}

export function renderSummary(input: ReportInput): void {
  const { errors, warnings } = summarize(input.findings, input.ruleIndex)
  const parts = [
    `scope=${input.scope}`,
    input.scopeFiles > 0 ? `${input.scopeFiles} 个文件` : null,
    '全量谓词在全项目快照上求值',
    `全局违规 ${input.globalFindings}`,
    `规则 ${input.rulesEnabled}/${input.rulesTotal}`,
    `豁免 ${input.exemptedCount}`,
    input.exemptedFiles > 0 ? `配置豁免 ${input.exemptedFiles} 个文件` : null,
    `${input.durationMs}ms`,
  ].filter(Boolean)
  out(color.dim(parts.join(' | ')))
  if (errors > 0) out(color.red(`✖ 架构守卫失败：${errors} 个 error、${warnings} 个 warn`))
  else out(color.green(`✔ 架构守卫通过${warnings > 0 ? `（${warnings} 个 warn）` : ''}`))
}

export interface JsonReport {
  ok: boolean
  errors: number
  warnings: number
  scope: string
  findings: (Finding & { domain?: Domain; level?: Level; severity: Severity })[]
  skipped: { rule: string; reason: string }[]
  exempted: number
  durationMs: number
}

export function toJsonReport(input: ReportInput): JsonReport {
  const { errors, warnings } = summarize(input.findings, input.ruleIndex)
  return {
    ok: errors === 0,
    errors,
    warnings,
    scope: input.scope,
    findings: input.findings.map((finding) => {
      const rule = input.ruleIndex.get(finding.rule)
      return {
        ...finding,
        domain: rule?.domain,
        level: rule?.level,
        severity: rule?.severity ?? 'error',
      }
    }),
    skipped: input.skipped,
    exempted: input.exemptedCount,
    durationMs: input.durationMs,
  }
}

/** GitHub Actions 注解：每条违规一行 `::error file=…,line=…::text`（reviewdog 风格） */
export function renderGithubAnnotations(input: ReportInput): string {
  const lines: string[] = []
  for (const finding of input.findings) {
    const severity = severityOf(finding, input.ruleIndex) === 'warn' ? 'warning' : 'error'
    const title = `${finding.rule} ${finding.text}`.replace(/[\r\n]+/g, ' ')
    lines.push(`::${severity} file=${finding.file},line=${finding.line},title=${title}::${title}`)
  }
  return lines.join('\n')
}

/** 规则耗时与命中统计（--stats）：用来回答「为什么这次跑了 3 秒」 */
export function renderStats(
  _input: ReportInput,
  stats: { rule: string; domain: string; ms: number; hits: number }[],
): string {
  const rows = [...stats].sort((a, b) => b.ms - a.ms)
  const total = stats.reduce((sum, item) => sum + item.ms, 0)
  const width = Math.max(...rows.map((row) => row.rule.length), 4)
  const lines = rows.map(
    (row) =>
      `  ${row.rule.padEnd(width)}  ${row.domain.padEnd(9)}  ${row.ms.toFixed(2).padStart(8)}ms  ${String(row.hits).padStart(3)} 命中`,
  )
  lines.push(`  合计 ${total.toFixed(2)}ms / ${rows.length} 条规则（扫描之外的时间：解析与图构建）`)
  return lines.join('\n')
}
