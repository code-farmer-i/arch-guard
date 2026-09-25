import { RETIRED_MARKERS } from '../../../data/retired-names.js'
import type { Finding, Rule } from '../../../engine/types.js'

import { finding } from './structure-util.js'

/**
 * H12 退路不留：文件名里的「旧实现」标记（`CrewsPage.old.tsx` / `useCrewsLegacy.ts`）。
 *
 * 场景：重构完把旧文件留在 `views/` 里，两年后没人敢删 —— 新人抄了旧的那一份，两套实现行为不一致。
 * 判定只认**整段**命中，不认子串：
 * - 分隔符形式：`CrewsPage.old.tsx` / `use-crews-old.ts` / `config_bak.ts`（标记紧挨扩展名）
 * - camelCase 形式：`useCrewsLegacy.ts`（标记紧跟扩展名之前，且首字母大写）
 *
 * 于是 `legacy-support.ts`（给旧环境兜底的正常模块）、`threshold.ts`（末尾正好是 "old"）
 * 都不会误报。目录名不参与判定（`src/legacy/**` 是迁移期的合法容器）。
 */
function retiredMarkerOf(rel: string): string | null {
  const base = rel.slice(rel.lastIndexOf('/') + 1)
  const stem = base.replace(/\.[^.]+$/, '')
  for (const marker of RETIRED_MARKERS) {
    const lower = marker.toLowerCase()
    // ① 分隔符 / 开头形式：CrewsPage.old、foo-old、foo_OLD、old
    if (new RegExp(`(?:^|[-._])${lower}$`, 'i').test(stem)) return marker
    // ② camelCase 形式：useCrewsLegacy（大写开头且前面是小写字母，`Legacy` 本身不算）
    const camel = lower[0]?.toUpperCase() + lower.slice(1)
    if (stem.length > camel.length && stem.endsWith(camel)) {
      const before = stem[stem.length - camel.length - 1] as string
      if (before === before.toLowerCase() && before !== before.toUpperCase()) return marker
    }
  }
  return null
}

export const noRetiredCopies: Rule = {
  id: 'H12',
  domain: 'hygiene',
  level: 'L1',
  severity: 'error',
  title: '退路不留（新旧实现并存）',
  hint: '删掉旧文件、把还在用的逻辑合回主实现；确实是"给旧环境兜底"的模块，用规则级 exceptions 写清理由',
  run: (ctx) => {
    const out: Finding[] = []
    for (const record of ctx.records) {
      const marker = retiredMarkerOf(record.rel)
      if (!marker) continue
      out.push(
        finding(
          'H12',
          record.rel,
          1,
          `退路残留：文件名里的 ${marker} 说明这是旧实现`,
          '删掉它；还在用的逻辑合回主实现 —— 留着迟早有人抄错那一份',
        ),
      )
    }
    return out
  },
}

export const hygieneRetiredRules: Rule[] = [noRetiredCopies]
