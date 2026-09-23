/**
 * 元框架 → 源码扩展名（**纯数据**）。
 *
 * 为什么是数据表：引擎层与通用预设里不许出现具体框架名（见 PARADIGM §7.1「元自检加强」），
 * 「本工具认识哪些框架、哪个已经有 pack」这份真相只在这里存一份。
 *
 * `implemented: false` 的框架不是「以后支持」，而是**现在量不了** —— 配置里声明它必须
 * fail-closed 报错，绝不能出现「0 个文件 → ✔ 通过」这种假绿。
 */
export interface FrameworkSource {
  /** 框架标识（配置里 `metaFramework` 的取值） */
  id: string
  /** 该框架的源码文件扩展名 */
  extensions: string[]
  /** 本工具是否已经有这个框架的 pack */
  implemented: boolean
}

export const frameworkSources: FrameworkSource[] = [
  {
    id: 'react',
    extensions: ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'],
    implemented: true,
  },
  { id: 'vue', extensions: ['.vue'], implemented: false },
  { id: 'svelte', extensions: ['.svelte'], implemented: false },
  { id: 'astro', extensions: ['.astro'], implemented: false },
]

/** 引擎默认框架：取第一个已实现的 pack，避免在引擎里写字面量 */
export const defaultFramework: string =
  frameworkSources.find((item) => item.implemented)?.id ?? 'react'

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
