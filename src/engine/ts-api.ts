import { createRequire } from 'node:module'

/**
 * TypeScript 编译器 API 的可用性自检（fail-closed）。
 *
 * 为什么需要它：`typescript@7` 是原生重写，JS 侧只导出 `version` 之类的信息，
 * **不再提供 `createSourceFile` / `ScriptKind`**。我们依赖 parser API，遇到这种版本
 * 必须给出可执行的报错，而不是让用户看到 `Cannot read properties of undefined (reading 'TS')`。
 */

const SUPPORTED_RANGE = '>=5.4 <7'

/** 读已安装的 typescript 版本；读不到就返回未知（可注入，便于测异常分支） */
export function installedVersion(read: () => string = defaultVersionReader): string {
  try {
    return read()
  } catch {
    return '未知'
  }
}

function defaultVersionReader(): string {
  const require = createRequire(import.meta.url)
  const pkg = require('typescript/package.json') as { version?: string }
  return pkg.version ?? '未知'
}

/** 纯函数：返回问题描述；没问题返回 null（便于单测，不依赖真实 typescript） */
export function describeTypeScriptProblem(api: unknown, version?: string): string | null {
  if (!api || typeof api !== 'object') return 'typescript 模块没有导出任何东西'
  const candidate = api as { createSourceFile?: unknown; ScriptKind?: unknown }
  const missing: string[] = []
  if (typeof candidate.createSourceFile !== 'function') missing.push('createSourceFile')
  if (!candidate.ScriptKind) missing.push('ScriptKind')
  if (missing.length === 0) return null
  return `当前 typescript（${version ?? installedVersion()}）不提供编译器 API：${missing.join(' / ')}`
}

export function assertTypeScriptApi(api: unknown): void {
  const problem = describeTypeScriptProblem(api)
  if (problem === null) return
  throw new Error(
    `${problem}。\n` +
      `arch-guard 需要 typescript ${SUPPORTED_RANGE}（7.x 是原生重写，不再暴露编译期 API）。\n` +
      '请安装受支持版本，例如：pnpm add -D typescript@6',
  )
}
