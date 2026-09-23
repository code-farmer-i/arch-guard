import { createRule } from '../../../engine/rule.js'
import type { DetachedApi, Finding, Rule } from '../../../engine/types.js'

/**
 * 反退化域（H）续：上下文纪律、假异步、硬编码地址、假数据、手搓时间格式化。
 * 全部基于单文件事实（calls / strings），判定等级 L2。
 */

const finding = (
  rule: string,
  file: string,
  line: number,
  text: string,
  hint?: string,
): Finding => ({
  rule,
  file,
  line,
  text,
  ...(hint ? { hint } : {}),
})

/** import 语句里的包名（@scope/x、x/sub 归一化到包） */
function packageOf(spec: string): string {
  const parts = spec.split('/')
  return spec.startsWith('@') ? parts.slice(0, 2).join('/') : (parts[0] ?? spec)
}

/* ---------------- H06 脱离上下文的全局 API ---------------- */

/**
 * H06：适配器登记的成员被**静态**调用即报（`message.success` / `notification.error` / `Modal.confirm`）。
 * 只在文件确实从该库 import 了的时候判 —— 用 `App.useApp()` 取到的实例是上下文内用法，形态上无法靠 callee 区分，
 * 但「没 import 过静态成员」是确定性事实。提示直接给适配器里的 suggest。
 */
export const noDetachedApis: Rule = createRule({
  id: 'H06',
  domain: 'hygiene',
  level: 'L2',
  severity: 'error',
  title: '脱离上下文的全局 API',
  requires: ['uiKit.detachedApis'],
  hint: '改用上下文内用法（组件库适配器的 detachedApis.suggest 给了替代写法），静态方法不继承主题与 locale 上下文',
  run: (ctx) => {
    const adapter = Object.values(ctx.config.adapters).find((item) => item.facet === 'ui-kit') as
      { detachedApis?: DetachedApi[] } | undefined
    const groups = adapter?.detachedApis ?? []
    if (groups.length === 0) return []

    const out: Finding[] = []
    for (const record of ctx.records) {
      const facts = ctx.facts.get(record.rel)
      if (!facts) continue
      const imported = new Set(facts.imports.map((item) => packageOf(item.spec)))

      for (const group of groups) {
        if (!group.from.some((pkg) => imported.has(pkg))) continue
        for (const call of facts.calls) {
          const member = group.members.find(
            (name) => call.callee === name || call.callee.startsWith(`${name}.`),
          )
          if (!member) continue
          out.push(
            finding(
              'H06',
              record.rel,
              call.line,
              `脱离上下文的全局调用：${call.callee}`,
              group.suggest,
            ),
          )
        }
      }
    }
    return out
  },
})

export const contextHygieneRules: Rule[] = [
  // 其余退化模式已委派：假异步/随机、硬编码地址、假数据 → eslint no-restricted-syntax；
  // 手搓时间格式化 → P06（能力指纹，项目声明了日期库才算手搓，比语法级封杀更准）。
  noDetachedApis,
]
