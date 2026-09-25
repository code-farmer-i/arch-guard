import { existsSync, readFileSync } from 'node:fs'

import type { WheelFingerprint } from '../data/wheel-fingerprints.js'
import { builtinModules } from 'node:module'
import { join } from 'node:path'

/**
 * 依赖纪律的数据层：读取项目的依赖事实 + 把 config.params 里的策略解析成强类型。
 *
 * 三个字段的语义（见 PARADIGM.md §12）：
 * - allow        运行时依赖白名单（约束 package.json 的 dependencies）
 * - deny         明确禁用（命中即错，与 allow 无关）
 * - capabilities 能力 → 首选方案（约束**代码形态**：别手搓）
 */

export interface ProjectDeps {
  /** 项目根有没有 package.json；没有就整体跳过依赖类规则 */
  hasManifest: boolean
  /** dependencies 里的包名 */
  runtime: string[]
  /** devDependencies 里的包名（工具链，不占运行时白名单） */
  dev: string[]
  /** peerDependencies 里的包名 */
  peer: string[]
  /** 三者并集 */
  declared: Set<string>
  /** 源码里真实 import 的第三方包 */
  imported: Set<string>
  /** import 了但没在任何 dependencies 段声明（幽灵依赖） */
  phantom: string[]
  /** 声明了但全项目零引用 */
  unused: string[]
}

/**
 * **指纹覆盖**（R-73）：项目对某个能力的指纹证据加 / 删、或放宽。
 *
 * 为什么需要：内置的轮子指纹表是通用判断 ——
 *   - **收紧**：企业规范只认内部实现，想让某条形态也命中；
 *   - **放宽**：项目里那个 `@org/utils` 其实很成熟，或某个形态已经是"项目认可的封装"，
 *     不该继续提示。
 *
 * **首选方案不在这里**（那是 `capabilities` 的活，一个事实只有一个出处）；
 * 这里只管"什么形态算手搓"与"这个能力允不允许自研"。
 */
export interface FingerprintOverride {
  /** 能力标识（必须与内置表里的某个能力同名 —— 拼错会让这条覆盖静默失效） */
  capability: string
  /** 追加**强**指纹（单证据即报） */
  addSyntax?: string[]
  /** 删掉内置的强指纹（按 pattern 原文精确匹配） */
  removeSyntax?: string[]
  /** 追加**弱**指纹（需与命名指纹叠加） */
  addSoftSyntax?: string[]
  /** 删掉内置的弱指纹 */
  removeSoftSyntax?: string[]
  /** 覆盖该能力的常见 API 名清单（命名指纹那一半） */
  apiNames?: string[]
  /** 放宽 / 收紧「允许项目自研」：true → P06 降级为 warn */
  allowOwn?: boolean
  /** 改判"平台内置能力"（平台能力没有 import 可查 → 没有豁免） */
  platform?: boolean
  /** 覆盖推荐写法（进报告 hint） */
  hint?: string
}

export interface DepsPolicy {
  allow: string[]
  deny: string[]
  capabilities: Record<string, string>
  fingerprints: FingerprintOverride[]
}

const STRING_FIELDS = [
  'addSyntax',
  'removeSyntax',
  'addSoftSyntax',
  'removeSoftSyntax',
  'apiNames',
] as const

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

/**
 * 把覆盖作用到指纹表上：**加**在原有之后、**删**按 pattern 原文精确匹配。
 * 纯函数、不改入参（数据表是模块级常量，改它就会污染同一进程里的其它宿主）。
 */
export function applyFingerprintOverrides(
  base: readonly WheelFingerprint[],
  overrides: readonly FingerprintOverride[],
): WheelFingerprint[] {
  if (overrides.length === 0) return [...base]
  const byCapability = new Map(overrides.map((item) => [item.capability, item]))
  return base.map((entry) => {
    const override = byCapability.get(entry.capability)
    if (!override) return { ...entry }
    const merge = (current: string[] | undefined, add?: string[], remove?: string[]): string[] => {
      const removed = new Set(remove ?? [])
      return [...(current ?? []).filter((pattern) => !removed.has(pattern)), ...(add ?? [])]
    }
    return {
      ...entry,
      syntax: merge(entry.syntax, override.addSyntax, override.removeSyntax),
      softSyntax: merge(entry.softSyntax, override.addSoftSyntax, override.removeSoftSyntax),
      ...(override.apiNames ? { apiNames: [...override.apiNames] } : {}),
      ...(override.allowOwn !== undefined ? { allowOwn: override.allowOwn } : {}),
      ...(override.platform !== undefined ? { platform: override.platform } : {}),
      ...(override.hint !== undefined ? { hint: override.hint } : {}),
    }
  })
}

interface PackageJson {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
}

export function readPackageJson(root: string): PackageJson | null {
  const file = join(root, 'package.json')
  if (!existsSync(file)) return null
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as PackageJson
  } catch {
    return null
  }
}

/** 依赖事实：声明了什么、真实用了什么、两边对不上的（幽灵 / 死依赖） */
export function readProjectDeps(root: string, imported: Iterable<string>): ProjectDeps {
  const manifest = readPackageJson(root)
  const pkg = manifest ?? {}
  const runtime = Object.keys(pkg.dependencies ?? {})
  const dev = Object.keys(pkg.devDependencies ?? {})
  const peer = Object.keys(pkg.peerDependencies ?? {})
  const declared = new Set([...runtime, ...dev, ...peer])
  // Node 内置模块不是依赖（node:fs / fs / node:test …）
  const importedSet = new Set(
    [...imported].filter((name) => !name.startsWith('node:') && !builtinModules.includes(name)),
  )
  return {
    // 清单文件是否存在（存在但没声明依赖，仍是有效事实：所有 import 都是幽灵）
    hasManifest: manifest !== null,
    runtime,
    dev,
    peer,
    declared,
    imported: importedSet,
    phantom: [...importedSet].filter((name) => !declared.has(name)).sort(),
    // 只报运行时依赖的"声明未用"：dev 与 peer 可能只给工具链用
    unused: runtime.filter((name) => !importedSet.has(name)).sort(),
  }
}

function overridesFrom(value: unknown): FingerprintOverride[] {
  if (!Array.isArray(value)) return []
  const out: FingerprintOverride[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const raw = item as Record<string, unknown>
    if (typeof raw.capability !== 'string' || raw.capability === '') continue
    const override: FingerprintOverride = { capability: raw.capability }
    for (const field of STRING_FIELDS) {
      const list = asStringArray(raw[field])
      if (list.length > 0) override[field] = list
    }
    if (typeof raw.allowOwn === 'boolean') override.allowOwn = raw.allowOwn
    if (typeof raw.platform === 'boolean') override.platform = raw.platform
    if (typeof raw.hint === 'string' && raw.hint !== '') override.hint = raw.hint
    out.push(override)
  }
  return out
}

export function depsPolicyFrom(params: Record<string, unknown>): DepsPolicy {
  const rawCapabilities = params.capabilities
  const capabilities: Record<string, string> = {}
  if (rawCapabilities && typeof rawCapabilities === 'object' && !Array.isArray(rawCapabilities)) {
    for (const [key, value] of Object.entries(rawCapabilities as Record<string, unknown>)) {
      if (typeof value === 'string') capabilities[key] = value
    }
  }
  return {
    allow: asStringArray(params.allow),
    deny: asStringArray(params.deny),
    capabilities,
    fingerprints: overridesFrom(params.fingerprints),
  }
}

/**
 * 策略自洽性检查：**配置自相矛盾必须报错，不能默默按某一侧生效**。
 * 例如：把某能力的首选库同时写进 deny。
 */
export function policyConflicts(
  policy: DepsPolicy,
  platformCapabilities: Iterable<string> = [],
): string[] {
  const platform = new Set(platformCapabilities)
  const conflicts: string[] = []
  for (const [capability, preferred] of Object.entries(policy.capabilities)) {
    if (platform.has(capability)) continue // 平台内置（structuredClone / Intl / URLSearchParams…）不是依赖
    if (policy.deny.includes(preferred)) {
      conflicts.push(`能力 ${capability} 的首选是 ${preferred}，但它同时出现在 deny 里`)
    }
    if (policy.allow.length > 0 && !policy.allow.includes(preferred)) {
      conflicts.push(`能力 ${capability} 的首选是 ${preferred}，但它不在 allow 白名单里`)
    }
  }
  return conflicts
}
