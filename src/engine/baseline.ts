import { existsSync, readFileSync, writeFileSync } from 'node:fs'

import type { Finding } from './types.js'
import { anchorOf, sha1 } from './util.js'

/**
 * 棘轮：豁免锚点 = 规则 + 文件 + 稳定签名。
 * - 单行违规 → 规范化行文本哈希（那行一改，豁免立即失效）
 * - 文件级 / 符号级 → 由规则给出 anchor（锚点定义见 CONTEXT.md）
 */

export interface BaselineEntry {
  rule: string
  file: string
  anchor: string
  anchorKind: 'line' | 'file' | 'symbol'
}

export interface BaselineFile {
  version: number
  /** 基线格式版本（不兼容时显式报错，不静默按老格式解读） */
  specVersion?: string
  entries: BaselineEntry[]
}

export const EMPTY_BASELINE: BaselineFile = { version: 1, entries: [] }

/** 基线格式版本：不兼容时必须显式报错，不能静默按老格式解读 */
export const BASELINE_SPEC_VERSION = '1'

export function loadBaseline(path: string): BaselineFile {
  if (!existsSync(path)) return { ...EMPTY_BASELINE, entries: [] }
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as BaselineFile
    if (parsed.specVersion !== undefined && parsed.specVersion !== BASELINE_SPEC_VERSION) {
      throw new Error(
        `基线 specVersion 不支持：${parsed.specVersion}（本工具是 ${BASELINE_SPEC_VERSION}）；请重新生成基线`,
      )
    }
    return {
      version: parsed.version ?? 1,
      specVersion: BASELINE_SPEC_VERSION,
      entries: parsed.entries ?? [],
    }
  } catch {
    throw new Error(`基线文件无法解析：${path}（应当是 arch-guard 生成的 JSON）`)
  }
}

export function saveBaseline(path: string, entries: BaselineEntry[]): void {
  const sorted = [...entries].sort(
    (a, b) =>
      a.rule.localeCompare(b.rule) ||
      a.file.localeCompare(b.file) ||
      a.anchor.localeCompare(b.anchor),
  )
  writeFileSync(
    path,
    `${JSON.stringify({ version: 1, specVersion: BASELINE_SPEC_VERSION, entries: sorted }, null, 2)}\n`,
    'utf8',
  )
}

export function anchorFor(
  finding: Finding,
  sourceOf: (rel: string) => string | undefined,
): BaselineEntry {
  const anchorKind = finding.anchorKind ?? 'line'
  if (finding.anchor)
    return { rule: finding.rule, file: finding.file, anchor: finding.anchor, anchorKind }
  if (anchorKind === 'file') {
    return {
      rule: finding.rule,
      file: finding.file,
      anchor: sha1(finding.file),
      anchorKind: 'file',
    }
  }
  const line = sourceOf(finding.file)?.split('\n')[finding.line - 1]
  return { rule: finding.rule, file: finding.file, anchor: anchorOf(line), anchorKind }
}

export interface BaselineSplit {
  active: Finding[]
  exempted: { finding: Finding; entry: BaselineEntry }[]
  unused: BaselineEntry[]
}

export function applyBaseline(
  findings: Finding[],
  baseline: BaselineFile,
  sourceOf: (rel: string) => string | undefined,
): BaselineSplit {
  const byKey = new Map<string, BaselineEntry[]>()
  for (const entry of baseline.entries) {
    const key = `${entry.rule}|${entry.file}`
    const list = byKey.get(key) ?? []
    list.push(entry)
    byKey.set(key, list)
  }
  /** 命中的条目（用于算过期豁免）；**不消耗**条目 —— 同一行可能有多条违规（如一行里两个内联样式），
   *  它们共享同一个行文本锚点，消耗式匹配会让第二条永远无法豁免。 */
  const used = new Set<BaselineEntry>()

  const active: Finding[] = []
  const exempted: { finding: Finding; entry: BaselineEntry }[] = []

  for (const finding of findings) {
    const candidate = anchorFor(finding, sourceOf)
    const key = `${candidate.rule}|${candidate.file}`
    const entry = byKey.get(key)?.find((item) => item.anchor === candidate.anchor)
    if (entry) {
      used.add(entry)
      exempted.push({ finding, entry })
      continue
    }
    active.push(finding)
  }

  const unused = baseline.entries.filter((entry) => !used.has(entry))
  return { active, exempted, unused }
}

export function entriesFromFindings(
  findings: Finding[],
  sourceOf: (rel: string) => string | undefined,
): BaselineEntry[] {
  const seen = new Set<string>()
  const entries: BaselineEntry[] = []
  for (const finding of findings) {
    const entry = anchorFor(finding, sourceOf)
    const key = `${entry.rule}|${entry.file}|${entry.anchor}`
    if (seen.has(key)) continue
    seen.add(key)
    entries.push(entry)
  }
  return entries
}
