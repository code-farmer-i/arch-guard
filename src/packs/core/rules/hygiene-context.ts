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

/* ---------------- H08 硬编码本地地址 ---------------- */

/**
 * 判据：**指向本机 / 内网 IP** 的地址字面量出现在非测试文件里。
 *
 * 为什么只判这一类（原委派给 eslint `no-restricted-syntax`）：那条要项目自己写 esquery 选择器；
 * 而"本地地址进生产"是这一段里**误伤最小**的一类 —— 外部文档链接（`https://docs.…`）不算，
 * 测试文件里的 `http://localhost` 是正常用法（mock 服务）。
 */
const LOCAL_HOST = /\b(?:https?:\/\/)?(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(?::\d+)?/i
const PRIVATE_IP = /\b(?:10|192\.168|172\.(?:1[6-9]|2\d|3[01]))\.\d{1,3}\.\d{1,3}\b/

export const localHostLiterals: Rule = {
  id: 'H08',
  domain: 'hygiene',
  level: 'L1',
  severity: 'error',
  title: '禁硬编码本地地址',
  hint: '本地 / 内网地址走环境变量或配置；写进源码就会跟着构建进生产',
  run: (ctx) => {
    const out: Finding[] = []
    for (const record of ctx.records) {
      if (record.role === 'test' || /\.(test|spec)\./.test(record.rel)) continue
      const facts = ctx.facts.get(record.rel)
      if (!facts) continue
      for (const text of facts.strings) {
        if (!LOCAL_HOST.test(text.value) && !PRIVATE_IP.test(text.value)) continue
        out.push(
          finding(
            'H08',
            record.rel,
            text.line,
            `硬编码本地地址：${text.value}`,
            '改成环境变量 / 配置项（本地默认值放在 .env 或构建配置里）',
          ),
        )
      }
    }
    return out
  },
}

export const contextHygieneRules: Rule[] = [
  localHostLiterals,
  // 其余退化模式已委派：假异步/随机、硬编码地址、假数据 → eslint no-restricted-syntax；
  // 手搓时间格式化 → P06（能力指纹，项目声明了日期库才算手搓，比语法级封杀更准）。
  noDetachedApis,
]
