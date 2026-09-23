import type { Rule } from './types.js'

/**
 * 框架包的声明式定义（第三个扩展点：前两个是「配置」与「适配器」）。
 *
 * 包 = 一组规则 + 一个 id + 实现哪个元框架。定义时就把「id 重复」「规则域与 id 前缀错位」
 * 这类错误挡下来，而不是等运行时在某个文件上莫名不报。
 */
export interface Pack {
  id: string
  /**
   * 这个 pack 实现哪个元框架（取值见 `src/data/framework-sources.ts`）。
   * 与配置里的 `metaFramework` 是**同一处真相**：配了包就以包为准；两边都写且不一致直接报错。
   */
  framework: string
  rules: Rule[]
  /** 这个包建议搭配的适配器面（缺了就进 skipped，不是静默失能） */
  adapters?: string[]
}

export class PackError extends Error {}

export function definePack(spec: Pack): Pack {
  if (typeof spec.id !== 'string' || spec.id.trim().length === 0) {
    throw new PackError('包必须有非空 id')
  }
  if (typeof spec.framework !== 'string' || spec.framework.trim().length === 0) {
    throw new PackError(`[${spec.id}] 包必须声明 framework（它实现哪个元框架）`)
  }
  if (!Array.isArray(spec.rules) || spec.rules.length === 0) {
    throw new PackError(`[${spec.id}] 包必须带至少一条规则`)
  }
  const seen = new Map<string, string>()
  for (const rule of spec.rules) {
    const previous = seen.get(rule.id)
    if (previous !== undefined && previous !== rule.title) {
      throw new PackError(`[${spec.id}] 规则 id 重复：${rule.id}（${previous} / ${rule.title}）`)
    }
    seen.set(rule.id, rule.title)
  }
  return Object.freeze({
    ...spec,
    rules: Object.freeze([...spec.rules]) as unknown as Rule[],
  }) as Pack
}
