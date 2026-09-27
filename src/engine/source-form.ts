import { frameworkSourceOf } from '../data/framework-sources.js'
import type { Rule } from './types.js'

/**
 * **源码形态**的实现绑定：一个形态（`typescript` / `react` / 将来的 `vue`）对应的
 * 规则集 + 它支持哪些方案面（facet）。
 *
 * 为什么类型在引擎层、值在 `packs/registry.ts`：`framework-sources.ts` 是**层 1 的纯数据**
 * （只写"认识哪些形态、各自管哪些扩展名"），而 `rules` 是层 4 的代码 ——
 * 让数据层引用规则集就是反向依赖（S21 / 狗粮会红）。所以绑定由**调用方注入** `loadConfig`。
 *
 * 宿主**不再接触这个概念**：配置里只写 `sourceForm: 'react'`（见 ADR-0009）。
 */
export interface SourceFormBinding {
  /** 形态 id，必须是 `framework-sources.ts` 里认识的那个（否则配置期报错） */
  id: string
  rules: Rule[]
  /** 这套规则集消费哪些适配器面（fail-closed：配置里配了没被声明的面就报错） */
  adapters: string[]
}

export class SourceFormError extends Error {}

/**
 * 绑定定义的校验（原 `definePack` 的职责，去掉 `framework` —— 形态由 `sourceForm` 选、按 id 匹配）。
 *
 * 挡住的失败模式与原来一致：id 空 / 规则空 / 同一份规则集里 id 重复且 title 不同
 * （后者在**合并**时也会再查一遍，见 `mergeRules`）。
 */
export function defineSourceForm(spec: SourceFormBinding): SourceFormBinding {
  if (typeof spec.id !== 'string' || spec.id.trim().length === 0) {
    throw new SourceFormError('源码形态绑定必须有非空 id')
  }
  if (frameworkSourceOf(spec.id) === undefined) {
    throw new SourceFormError(
      `源码形态绑定「${spec.id}」不在 data/framework-sources.ts 的形态表里（先在数据表登记它）`,
    )
  }
  if (!Array.isArray(spec.rules) || spec.rules.length === 0) {
    throw new SourceFormError(`[${spec.id}] 绑定必须带至少一条规则`)
  }
  checkRuleCollisions(spec.id, spec.rules)
  return Object.freeze({
    ...spec,
    rules: Object.freeze([...spec.rules]) as unknown as Rule[],
    adapters: Object.freeze([...spec.adapters]) as unknown as string[],
  }) as SourceFormBinding
}

/** 同一份规则集里 id 重复且 title 不同 → 报错（同 title 视为同一规则的幂等重复声明） */
function checkRuleCollisions(where: string, rules: Rule[]): void {
  const seen = new Map<string, string>()
  for (const rule of rules) {
    const previous = seen.get(rule.id)
    if (previous !== undefined && previous !== rule.title) {
      throw new SourceFormError(
        `[${where}] 规则 id 重复：${rule.id}（${previous} / ${rule.title}）`,
      )
    }
    seen.set(rule.id, rule.title)
  }
}

/**
 * **规则的合并**（R-143）：内置规则集 + `overrides.customRules`（追加）。
 *
 * 一处实现、两条调用（`defineSourceForm` 的自校验与 `loadConfig` 的解析期合并）：
 * - 同 id + 同 title → **幂等**（允许把同一个规则声明两遍，例如 `customRules: [...内置]`）；
 * - 同 id + 不同 title → **报错**（fail-closed：不许后来者静默覆盖）。
 *
 * 合并结果就是 `Config.rules` —— CLI 与 runner 读同一份，不再各自推导。
 */
export function mergeRules(where: string, base: Rule[], extra: Rule[]): Rule[] {
  const out = new Map<string, Rule>()
  for (const rule of [...base, ...extra]) {
    const previous = out.get(rule.id)
    if (previous !== undefined && previous.title !== rule.title) {
      throw new SourceFormError(
        `${where}：规则 ${rule.id} 有两份不同的实现（${previous.title} / ${rule.title}）\n` +
          '（同 id 的规则只能有一处真相；要改就改来源，别指望后者覆盖前者）',
      )
    }
    out.set(rule.id, rule)
  }
  return [...out.values()]
}
