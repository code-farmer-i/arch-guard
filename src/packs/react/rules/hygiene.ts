import type { Finding, Rule } from '../../../engine/types.js'

const finding = (rule: string, file: string, line: number, text: string, hint?: string): Finding => ({
  rule,
  file,
  line,
  text,
  ...(hint ? { hint } : {}),
})

const TS_COMMENT = /@ts-(ignore|expect-error|nocheck)/
const SUPPRESSION = /(eslint|oxlint|biome)-disable/
const ABANDONED = /\b(TODO|FIXME|XXX|HACK|WIP)\b/
const NOT_IMPLEMENTED = /(not implemented|NotImplemented|暂未实现|待实现|待开发)/i
const DEBUG_CALLEES = /^(console\.|alert$|confirm$|prompt$)/

/** H01 类型逃生舱 */
export const noTypeEscape: Rule = {
  id: 'H01',
  domain: 'hygiene',
  level: 'L2',
  severity: 'error',
  title: '类型逃生舱',
  hint: '用判别联合 / 类型守卫 / unknown + 收窄，别用 any 与 !',
  run: (ctx) =>
    ctx.records.flatMap((record) => {
      const facts = ctx.facts.get(record.rel)
      if (!facts) return []
      const out: Finding[] = []
      for (const node of facts.anyNodes) out.push(finding('H01', record.rel, node.line, 'any 类型逃生舱'))
      for (const node of facts.nonNull) out.push(finding('H01', record.rel, node.line, '非空断言 !'))
      for (const comment of facts.comments) {
        const match = comment.text.match(TS_COMMENT)
        if (match) out.push(finding('H01', record.rel, comment.line, `类型逃生舱注释：${match[0]}`))
      }
      return out
    }),
}

/** H02 suppression 注释：门禁不接受内联豁免（豁免只有 config 白名单与基线两条官方通道） */
export const noSuppression: Rule = {
  id: 'H02',
  domain: 'hygiene',
  level: 'L2',
  severity: 'error',
  title: '禁 suppression 注释',
  hint: '豁免走 arch.config.mjs 白名单或基线，不写内联注释',
  run: (ctx) =>
    ctx.records.flatMap((record) => {
      const facts = ctx.facts.get(record.rel)
      if (!facts) return []
      return facts.comments
        .filter((comment) => SUPPRESSION.test(comment.text))
        .map((comment) => finding('H02', record.rel, comment.line, `禁用注释：${comment.text.trim().slice(0, 60)}`))
    }),
}

/** H03 调试残留 */
export const noDebugLeftovers: Rule = {
  id: 'H03',
  domain: 'hygiene',
  level: 'L2',
  severity: 'error',
  title: '调试残留',
  hint: '提交前删掉 console / debugger / alert',
  run: (ctx) =>
    ctx.records.flatMap((record) => {
      const facts = ctx.facts.get(record.rel)
      if (!facts) return []
      const out: Finding[] = []
      for (const call of facts.calls) {
        if (call.callee === 'debugger') {
          out.push(finding('H03', record.rel, call.line, 'debugger 残留'))
          continue
        }
        if (DEBUG_CALLEES.test(call.callee)) {
          out.push(finding('H03', record.rel, call.line, `调试残留：${call.callee}`))
        }
      }
      return out
    }),
}

/** H04 未完成标记：agent 最爱的退路 */
export const noUnfinishedMarkers: Rule = {
  id: 'H04',
  domain: 'hygiene',
  level: 'L2',
  severity: 'error',
  title: '未完成标记',
  hint: '要么做完，要么开 issue——代码里不留 TODO / 待实现',
  run: (ctx) =>
    ctx.records.flatMap((record) => {
      const facts = ctx.facts.get(record.rel)
      if (!facts) return []
      const out: Finding[] = []
      for (const comment of facts.comments) {
        const match = comment.text.match(ABANDONED)
        if (match) out.push(finding('H04', record.rel, comment.line, `未完成标记：${match[0]}`))
      }
      for (const entry of facts.strings) {
        if (NOT_IMPLEMENTED.test(entry.value)) {
          out.push(finding('H04', record.rel, entry.line, `未完成占位：${entry.value.slice(0, 40)}`))
        }
      }
      return out
    }),
}

/** H05 吞异常：空 catch 且无注释说明 */
export const noSwallowedError: Rule = {
  id: 'H05',
  domain: 'hygiene',
  level: 'L2',
  severity: 'error',
  title: '吞异常',
  hint: '空 catch 必须写明为什么可以忽略',
  run: (ctx) =>
    ctx.records.flatMap((record) => {
      const facts = ctx.facts.get(record.rel)
      if (!facts) return []
      return facts.catches
        .filter((entry) => entry.statements === 0 && !entry.hasComment)
        .map((entry) => finding('H05', record.rel, entry.line, '空 catch 吞掉异常'))
    }),
}

export const hygieneRules: Rule[] = [noTypeEscape, noSuppression, noDebugLeftovers, noUnfinishedMarkers, noSwallowedError]
