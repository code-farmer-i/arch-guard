import { existsSync, readFileSync } from 'node:fs'
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

export interface DepsPolicy {
  allow: string[]
  deny: string[]
  capabilities: Record<string, string>
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

export function depsPolicyFrom(params: Record<string, unknown>): DepsPolicy {
  const asStringArray = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
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
