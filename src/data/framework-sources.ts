/**
 * **源码形态** → 源码扩展名（**纯数据**，层 1）。
 *
 * 为什么叫源码形态而不是"元框架"：它实际只决定两件事 ——
 * ① 哪些扩展名归我们管（`scan.ts`，其余形态的源码进 `foreign` 由 S20 报出）；
 * ② 报错文案里说"哪个形态量不了这些文件"。**没有任何规则按它分支**。
 * 所以一个纯 TS 库该声明 `typescript`，而不是被一个叫 "react" 的形态量 ——
 * React 只是 TS 家族里带 JSX 约定的特化，扩展名与 `typescript` 相同。
 *
 * **这张表只说"认识哪些形态、各自管哪些扩展名"**；"哪个形态真的有实现"是**层 4 的事实**
 * （`packs/registry.ts` 的绑定）—— 数据层不许引用规则集（那是代码），否则就是反向依赖。
 * 所以这里既没有 `implemented` 标志，也没有"本工具支持哪些"的名单：那是派生量，手写就是第二处真相。
 *
 * 没实现的形态（vue / svelte / astro）不是「以后支持」，而是**现在量不了** ——
 * 配置里声明它必须 fail-closed 报错，绝不能出现「0 个文件 → ✔ 通过」这种假绿。
 */
export interface FrameworkSource {
  /** 源码形态标识（配置里 `sourceForm` 的取值） */
  id: string
  /** 该形态的源码文件扩展名 */
  extensions: string[]
}

export const frameworkSources: FrameworkSource[] = [
  {
    id: 'typescript',
    extensions: ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'],
  },
  {
    id: 'react',
    extensions: ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'],
  },
  { id: 'vue', extensions: ['.vue'] },
  { id: 'svelte', extensions: ['.svelte'] },
  { id: 'astro', extensions: ['.astro'] },
]

/**
 * 引擎默认源码形态 = 表里第一条（今天 `typescript`）：引擎对**没声明形态**的调用方默认按 TS/JS 处理，
 * 不假设前端框架，也不在引擎里写框架名字面量。
 *
 * 注意这里**不**判断"有没有实现" —— 那是层 4 的绑定说了算（见 `packs/registry.ts`）。
 * 配置路径上仍 fail-closed：认不出的取值、或没有绑定的取值都直接报错（`loadConfig`）。
 */
export const defaultFramework: string = frameworkSources[0]?.id ?? 'typescript'

/**
 * 把取值解析成**一个可用的**源码形态 id：认识就用它，不认识/没给就兜回默认。
 *
 * 谁需要它：直接调 API（不经过 `loadConfig`）的程序化调用方可能没写 `sourceForm` ——
 * 那时若把它当成「未知形态」，`supportedExtensions` 会返回空集，于是所有 `.ts` 都被判成域外，
 * 结果是「文件集空 → 全绿」。所以这里兜回默认形态。
 */
export function resolveFramework(id: string | undefined): string {
  const found = id === undefined ? undefined : frameworkSourceOf(id)
  return found?.id ?? defaultFramework
}

export function frameworkSourceOf(id: string): FrameworkSource | undefined {
  return frameworkSources.find((item) => item.id === id)
}

/** 该框架能处理的源码扩展名 */
export function supportedExtensions(id: string): Set<string> {
  return new Set(frameworkSourceOf(id)?.extensions ?? [])
}

/**
 * **别的**形态的源码扩展名 —— 出现这些文件说明项目里有当前形态量不了的源码。
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
