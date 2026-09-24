import { resolveSpecifier } from '../../../engine/graph.js'
import type { Finding, Rule } from '../../../engine/types.js'

import { finding } from './structure-util.js'

/**
 * S32 导入局部性：同组内必须相对导入，跨组必须走别名 / 包路径。
 *
 * 与社区 linter 一样**默认关闭**：声明 `structure.importLocality: ['<组维度>']` 才参与判定
 * （声明了才生效，不声明时这条规则不报任何东西）。
 */

/* ---------------- S32 导入局部性（同组相对 / 跨组非相对） ---------------- */

/**
 * 判据（只判项目内解析得到的边）：同组内必须相对导入，跨组必须走别名 / 包路径。
 * 声明 `structure.importLocality: ['slice']` 才生效 —— 与社区 linter 一样默认关闭。
 */
export const importLocality: Rule = {
  id: 'S32',
  domain: 'structure',
  level: 'L2',
  severity: 'error',
  title: '导入局部性',
  hint: '同组内用相对路径，跨组用别名：混着写会让"这条依赖到底跨没跨界"看不出来',
  run: (ctx) => {
    const dimensions = new Set(ctx.config.structure.importLocality ?? [])
    if (dimensions.size === 0) return []
    const fileSet = new Set(ctx.files)
    const byRel = new Map(ctx.records.map((record) => [record.rel, record]))
    const out: Finding[] = []
    for (const record of ctx.records) {
      if (record.layer >= 90) continue
      if (!record.groupName || !dimensions.has(record.groupName)) continue
      const facts = ctx.facts.get(record.rel)
      if (!facts) continue
      for (const imported of facts.imports) {
        const target = resolveSpecifier(imported.spec, record.rel, ctx.config, fileSet)
        if (target === null) continue
        const to = byRel.get(target)
        if (!to || to.layer >= 90) continue
        const sameGroup =
          record.groupName === to.groupName &&
          record.layer === to.layer &&
          record.group === to.group
        const relative = imported.spec.startsWith('.')
        if (relative && !sameGroup) {
          out.push(
            finding(
              'S32',
              record.rel,
              imported.line,
              `跨组不该用相对路径：${imported.spec}（跨组要走别名 / 包路径，依赖方向才看得见）`,
            ),
          )
        } else if (!relative && sameGroup) {
          out.push(
            finding(
              'S32',
              record.rel,
              imported.line,
              `同组内该用相对路径：${imported.spec}（组内互相引用走别名会让人以为它跨了界）`,
            ),
          )
        }
      }
    }
    return out
  },
}

export const structureLocalityRules: Rule[] = [importLocality]
