import type { Finding, Rule } from '../../../engine/types.js'
import { globToRegExp } from '../../../engine/util.js'

import { finding } from './structure-util.js'

/**
 * **H13 生成物必须带 `@generated` 标记**（R-81 / DESIGN §14 的 R6）。
 *
 * 场景：生成的类型 / 客户端文件没有标记，有人顺手改了它，下次重生成被覆盖 —— 手写逻辑静默消失。
 * 标记不是装饰：IDE、git blame、review 都靠它提示"这是生成物，别改"。
 *
 * 声明 `structure.generated: ['src/shared/api/generated/**']` 后，这些文件必须在**注释**里带
 * `@generated`；其余文件不判（手写代码不需要这个标记）。
 */
export const generatedMarker: Rule = {
  id: 'H13',
  domain: 'hygiene',
  level: 'L1',
  severity: 'error',
  title: '生成物必须带 @generated 标记',
  hint: '生成的文件在头部注释里写 `@generated`（编辑器 / review 靠它提醒"别手改，会被覆盖"）',
  run: (ctx) => {
    const globs = ctx.config.structure.generated ?? []
    if (globs.length === 0) return []
    const patterns = globs.map((glob) => globToRegExp(glob))
    const out: Finding[] = []
    for (const record of ctx.records) {
      if (!patterns.some((pattern) => pattern.test(record.rel))) continue
      const comments = ctx.facts.get(record.rel)?.comments ?? []
      if (comments.some((comment) => /@generated/i.test(comment.text))) continue
      out.push(
        finding(
          'H13',
          record.rel,
          1,
          '生成物没有 @generated 标记：别人会以为能改，重生成时那份手写逻辑会被覆盖',
          '在文件头部注释里写 @generated（生成器配置里加一行即可）',
        ),
      )
    }
    return out
  },
}
