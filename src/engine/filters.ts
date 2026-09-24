import { rootRelativePattern } from './git.js'
import { severityOf } from './report.js'
import type { Diagnostic, Finding, Rule, Severity } from './types.js'
import { globToRegExp } from './util.js'

/**
 * **报告过滤**：scope / `--paths` / `--severity`。
 *
 * 三者的共同规矩一句话：**只过滤报告，不过滤正确性；而且必须自述过滤掉了什么**。
 * 抽成独立模块的理由与 `git.ts` 一样（`runGuard` 有函数长度上限），顺带把这条规矩集中在一处：
 *
 * | 过滤器      | 会不会改变退出码 | 必须自述什么                                         |
 * | ----------- | ---------------- | ---------------------------------------------------- |
 * | `--scope`   | 默认不变（全局违规仍然失败） | 降级到全量、跳过多少条全局违规（`--local-only`）      |
 * | `--paths`   | 会（只看你问的文件）         | 0 个文件被匹配、过滤掉多少条全局违规                 |
 * | `--severity`| 会（只看你问的严重度）       | 过滤掉多少条 finding（含 error）                     |
 *
 * 空扫描域不由这里处理：`include` 非空却 0 个文件是 **S24 的 error**（配置写错，不是过滤）。
 */

export interface ReportFilterInput {
  active: Finding[]
  /** 变更集（`scope=full` 时为 null）；null 表示"取不到/不需要" */
  changed: { files: string[]; notice?: string } | null
  scope: string
  /** 本次会被解析的全部文件（域内 + 域外）：`--paths` 拿它判断"有没有文件被匹配" */
  scanned: Set<string>
  root: string
  ruleIndex: Map<string, Rule>
  paths?: string[]
  severity?: Severity
  localOnly?: boolean
  /** 自述性提示的收集处（报告与 JSON 都会输出） */
  notices: Diagnostic[]
}

export interface ReportFilterResult {
  active: Finding[]
  /** 本次 scope 覆盖、且**会被判定**的文件（full 模式下为空 —— 那个数字由 runGuard 用契约域内的文件填） */
  scopeFiles: string[]
  /** `--local-only` 丢掉的全局违规条数 */
  skippedGlobals: number
  /** `--severity` 过滤掉的 finding 条数 */
  filteredBySeverity: number
  /** `--paths` 实际匹配到的文件数；没给 `--paths` 时为 null（0 = 什么都没判 → 退出码非零） */
  pathsMatched: number | null
}

export function applyReportFilters(input: ReportFilterInput): ReportFilterResult {
  const { notices } = input
  let active = input.active
  let scopeFiles: string[] = []
  let skippedGlobals = 0
  let pathsMatched: number | null = null

  /* ---- scope：只过滤报告，不过滤正确性 ---- */
  if (input.scope !== 'full') {
    if (input.changed === null) {
      notices.push({
        code: 'scope-degraded-no-git',
        text: `scope=${input.scope} 无法取得 git 变更集（无 git 或无提交），已降级为全量`,
      })
    } else {
      if (input.changed.notice)
        notices.push({ code: 'scope-changed-relocated', text: input.changed.notice })
      // 只数**会被判定**的：变更集里完全可能有 README / 图片，它们不进解析集也不进判定
      scopeFiles = input.changed.files.filter((rel) => input.scanned.has(rel))
      const inScope = new Set(input.changed.files)
      active = active.filter((finding) => {
        if (inScope.has(finding.file)) return true
        if (finding.global) {
          // 不可归属的全局违规**默认仍然失败**；只有显式 --local-only 才放行 ——
          // 且放行多少条必须打出来（否则「零 error」就成了静默丢弃，见 DESIGN §6.8 退出码表）
          if (input.localOnly === true) {
            skippedGlobals += 1
            return false
          }
          return true
        }
        return false
      })
      if (skippedGlobals > 0) {
        notices.push({
          code: 'local-only-globals-skipped',
          text: `--local-only：跳过 ${skippedGlobals} 条不可归属的全局违规（架构级，需全量运行才可见）`,
        })
      }
    }
  }

  /* ---- --paths：IDE / lint 工具按文件传参的形态 ---- */
  if (input.paths && input.paths.length > 0) {
    // 同时接受配置根相对路径与**绝对路径**：不归一就会「一条都没匹配上」→ 静默假绿
    const matchers = input.paths.map((pattern) =>
      globToRegExp(rootRelativePattern(pattern, input.root)),
    )
    // 先看**文件**有没有匹配上（不是「有没有发现项」：匹配到的文件本来就可能干净）。
    // 0 个文件被匹配 = 什么都没查，必须自述 —— 路径打错是最常见的形态。
    const matchedFiles = [...input.scanned].filter((rel) =>
      matchers.some((matcher) => matcher.test(rel)),
    )
    pathsMatched = matchedFiles.length
    if (matchedFiles.length === 0) {
      notices.push({
        code: 'paths-no-match',
        text: `--paths 没有匹配到任何文件：${input.paths.join(', ')} —— 本次 0 个文件被判定，别当成"通过"`,
      })
    }
    const globalsBefore = active.filter((finding) => finding.global).length
    active = active.filter((finding) => matchers.some((matcher) => matcher.test(finding.file)))
    const globalsAfter = active.filter((finding) => finding.global).length
    if (globalsBefore > globalsAfter) {
      notices.push({
        code: 'paths-globals-filtered',
        text: `--paths 只报匹配的文件：本次另有 ${globalsBefore - globalsAfter} 条全局违规（架构级）被过滤，需全量运行才可见`,
      })
    }
  }

  /* ---- --severity：过滤只改报告，但「零 error」必须是说清楚了的零 ---- */
  let filteredBySeverity = 0
  if (input.severity) {
    const before = active.length
    active = active.filter((finding) => severityOf(finding, input.ruleIndex) === input.severity)
    filteredBySeverity = before - active.length
    if (filteredBySeverity > 0) {
      notices.push({
        code: 'severity-filtered',
        text: `--severity=${input.severity}：另有 ${filteredBySeverity} 条 finding 被过滤（含 error），需去掉该参数才可见`,
      })
    }
  }

  return { active, scopeFiles, skippedGlobals, filteredBySeverity, pathsMatched }
}
