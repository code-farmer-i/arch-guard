/**
 * **源码形态** → 源码扩展名（**纯数据**）。
 *
 * 为什么叫源码形态而不是"元框架"：pack 的 `framework` 实际只决定两件事 ——
 * ① 哪些扩展名归本包管（`scan.ts`，其余框架的源码进 `foreign` 由 S20 报出）；
 * ② 报错文案里说"哪个包量不了这些文件"。**没有任何规则按它分支**。
 * 所以一个纯 TS 库该用 `tsPack`（framework: `typescript`），而不是被一个叫 "react" 的包量 ——
 * React 只是 TS 家族里带 JSX 约定的特化，扩展名与 `typescript` 相同。
 *
 * 为什么是数据表：引擎层与通用预设里不许出现具体框架名（见 PARADIGM §7.1「元自检加强」），
 * 「本工具认识哪些源码形态、哪个已经有 pack」这份真相只在这里存一份。
 *
 * `implemented: false` 的不是「以后支持」，而是**现在量不了** —— 配置里声明它必须
 * fail-closed 报错，绝不能出现「0 个文件 → ✔ 通过」这种假绿。
 */
export interface FrameworkSource {
  /** 源码形态标识（配置里 `metaFramework` 的取值、pack 的 `framework`） */
  id: string
  /** 该形态的源码文件扩展名 */
  extensions: string[]
  /** 本工具是否已经有这个形态的 pack */
  implemented: boolean
}

export const frameworkSources: FrameworkSource[] = [
  {
    id: 'typescript',
    extensions: ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'],
    implemented: true,
  },
  {
    id: 'react',
    extensions: ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'],
    implemented: true,
  },
  { id: 'vue', extensions: ['.vue'], implemented: false },
  { id: 'svelte', extensions: ['.svelte'], implemented: false },
  { id: 'astro', extensions: ['.astro'], implemented: false },
]

/**
 * 引擎默认源码形态：取第一个已实现的 pack 的形态，避免在引擎里写字面量。
 * 第一个是 `typescript` —— 引擎对**没声明形态**的调用方默认按 TS/JS 处理，不假设前端框架。
 */
export const defaultFramework: string =
  frameworkSources.find((item) => item.implemented)?.id ?? 'typescript'

/**
 * 把配置里的取值解析成**一个可用的**框架 id。
 *
 * 谁需要它：直接调 API（不经过 `loadConfig`）的程序化调用方可能没写 `metaFramework` ——
 * 那时若把它当成「未知框架」，`supportedExtensions` 会返回空集，于是所有 `.ts` 都被判成域外，
 * 结果是「文件集空 → 全绿」。所以这里兜回默认框架。
 * 配置路径上的校验仍然 fail-closed（见 `loadConfig`）：认不出或没有 pack 的取值直接报错。
 */
export function resolveFramework(id: string | undefined): string {
  const found = id === undefined ? undefined : frameworkSourceOf(id)
  return found?.implemented === true ? found.id : defaultFramework
}

export function frameworkSourceOf(id: string): FrameworkSource | undefined {
  return frameworkSources.find((item) => item.id === id)
}

/** 已有 pack 的框架名（报错时列给用户看） */
export function implementedFrameworks(): string[] {
  return frameworkSources.filter((item) => item.implemented).map((item) => item.id)
}

/** 该框架能处理的源码扩展名 */
export function supportedExtensions(id: string): Set<string> {
  return new Set(frameworkSourceOf(id)?.extensions ?? [])
}

/**
 * **别的**框架的源码扩展名 —— 出现这些文件说明项目里有当前 pack 量不了的源码形态。
 * 这是 S20「框架包必须覆盖项目的源码形态」的判据（假绿的根因）。
 */
export function foreignExtensions(id: string): Set<string> {
  const mine = supportedExtensions(id)
  const out = new Set<string>()
  for (const item of frameworkSources) {
    for (const ext of item.extensions) if (!mine.has(ext)) out.add(ext)
  }
  return out
}
