import type { Finding, Rule } from '../../../engine/types.js'

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

const SUPPRESSION = /(eslint|oxlint|biome)-disable/
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
        .map((comment) =>
          finding('H02', record.rel, comment.line, `禁用注释：${comment.text.trim().slice(0, 60)}`),
        )
    }),
}

export const hygieneRules: Rule[] = [
  // 其余退化模式（any / ts-注释 / console / debugger / 未完成标记 / 空 catch）已委派给 eslint / oxlint，
  // 这里只留 lint 生态做不到的：禁 `eslint-disable`（反 lint 的元规则）。
  noSuppression,
]
