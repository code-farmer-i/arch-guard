import { out } from './output.js'
import type { Config, Domain, Finding, Level, Rule, Severity } from './types.js'
import { color } from './util.js'

/** 输出格式（CLI 与 explain 共用同一份取值） */
export type ReportFormat = 'pretty' | 'json' | 'github'

export interface ReportInput {
  config: Config
  ruleIndex: Map<string, Rule>
  findings: Finding[]
  skipped: { rule: string; reason: string }[]
  unknownEnabled: string[]
  notices: string[]
  scope: string
  scopeFiles: number
  globalFindings: number
  /** 因 `--local-only` 被跳过的不可归属全局违规条数（0 = 没跳过任何东西） */
  skippedGlobals: number
  /** 因 `--severity` 被过滤掉的 finding 条数（0 = 没过滤；过滤必须可见） */
  filteredBySeverity: number
  durationMs: number
  rulesEnabled: number
  rulesTotal: number
  /**
   * 规则级例外：声明了什么、各自命中几处。**必须可见** ——
   * 未命中的也要点名（那说明它已经可以删掉了），否则例外会慢慢积成隐形门禁关闭。
   */
  exceptions: ExceptionReport[]
  /** 契约扫描域（空 = 全树） */
  contractScope: string[]
  /** 扫描域之外、不参与目录契约判定的 ts/css 文件数 */
  outsideContract: number
}

export const DOMAIN_LABEL: Record<Domain, string> = {
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

  if (input.exceptions.length > 0) {
    const hits = input.exceptions.reduce((sum, entry) => sum + entry.hits, 0)
    out(color.dim(`\n例外（规则级）：命中 ${hits} 处 / ${input.exceptions.length} 条声明`))
    for (const entry of input.exceptions) {
      out(
        color.dim(
          `  · ${entry.rule} × ${entry.glob} —— ${entry.hits > 0 ? `命中 ${entry.hits} 处` : '未命中（可能可以删掉）'}；理由：${entry.reason}${entry.expires ? `；到期 ${entry.expires}` : ''}`,
        ),
      )
    }
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
    input.skippedGlobals > 0 ? `--local-only 跳过全局违规 ${input.skippedGlobals}` : null,
    input.filteredBySeverity > 0 ? `--severity 过滤 ${input.filteredBySeverity} 条` : null,
    `规则 ${input.rulesEnabled}/${input.rulesTotal}`,
    input.exceptions.length > 0
      ? `例外 ${input.exceptions.reduce((sum, entry) => sum + entry.hits, 0)} 处 / ${input.exceptions.length} 条声明`
      : null,
    input.contractScope.length > 0
      ? `扫描域 ${input.contractScope.join(',')}（域外 ${input.outsideContract} 个文件不判契约）`
      : null,
    `${input.durationMs}ms`,
  ].filter(Boolean)
  out(color.dim(parts.join(' | ')))
  if (errors > 0) out(color.red(`✖ 架构守卫失败：${errors} 个 error、${warnings} 个 warn`))
  else out(color.green(`✔ 架构守卫通过${warnings > 0 ? `（${warnings} 个 warn）` : ''}`))
}

/** 报告里的一条例外（规则级） */
export interface ExceptionReport {
  rule: string
  glob: string
  reason: string
  expires?: string
  /** 本次被它摘掉的发现项条数（0 = 声明了但没命中） */
  hits: number
}

export interface JsonReport {
  ok: boolean
  errors: number
  warnings: number
  scope: string
  findings: (Finding & { domain?: Domain; level?: Level; severity: Severity })[]
  skipped: { rule: string; reason: string }[]
  /** 因 `--local-only` 跳过的全局违规条数（机读侧同样不许静默丢弃） */
  skippedGlobals: number
  /** 因 `--severity` 过滤掉的 finding 条数（过滤改了报告，机读侧必须看得见） */
  filteredBySeverity: number
  /**
   * 全部自述性提示（扫描域 / 降级 / 缓存 / 过滤 / 退回工作区…）。
   * 放进 JSON 是为了让 **CI 与 agent 也看得到**：不然这些"说过的话"只存在于人读的那一行里。
   */
  notices: string[]
  /** 规则级例外（声明 + 命中数），机读侧同样可见 */
  exceptions: ExceptionReport[]
  /** 契约扫描域（空 = 全树），以及域外不判契约的文件数 */
  contractScope: string[]
  outsideContract: number
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
    exceptions: input.exceptions,
    skippedGlobals: input.skippedGlobals,
    filteredBySeverity: input.filteredBySeverity,
    notices: input.notices,
    contractScope: input.contractScope,
    outsideContract: input.outsideContract,
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
