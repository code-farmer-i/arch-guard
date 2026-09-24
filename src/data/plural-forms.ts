import pluralize from 'pluralize'

/**
 * 词形判定（S31 单复数一致性的判据来源）。
 *
 * **为什么用 `pluralize` 而不是自己写词表**：词形是"越老越准"的东西 —— `pluralize` 有十多年迭代、
 * 两万词级的规则与不可数表；我们手写的 115 行表在实测语料（315 个真实名字）上有 2.9% 分歧，
 * 其中 `alias` / `atlas`（单数被当成复数）与 `apis`（复数被 `-is` 守卫吞掉）是我们的**真 bug**。
 * 在"判词形"这件事上，成熟度直接等于准确率，所以引库而不是攒表。
 *
 * 依赖纪律：`pluralize` 已按 P1「审查门」登记（`src/engine/portability.ts` 的 `ALLOWED_BARE_IMPORTS`
 * 与 `package.json`、`arch.config.mjs` 的 `deps({ allow })`）—— 加依赖不是禁止的，是要**显式登记 + 写清理由**。
 * 库名出现在 `src/data/` 是 P4 允许的位置（数据表本身就是"库相关事实"的家）。
 *
 * 我们在库之上只加一层**政策**：中性词不参与判定。这一点照抄社区 linter 的做法
 * （`k8s` / `kubernetes` / `media`），只是把词表做成宿主可覆盖的声明
 * （`structure.pluralConsistency[].neutralWords`）—— 不可数词无论被当成单数还是复数都会制造噪音。
 */

/** 中性词：天然不分单复数，参与判定只会制造噪音。默认值照抄社区 linter，宿主可以再加 */
export const NEUTRAL_WORDS: string[] = ['k8s', 'kubernetes', 'media']

export type WordForm = 'plural' | 'singular' | 'neutral'

/** 判定一个词更像复数还是单数；中性词返回 `neutral`（不参与判定） */
export function classifyWord(word: string, neutralWords: string[] = NEUTRAL_WORDS): WordForm {
  const lower = word.toLowerCase()
  if (neutralWords.some((item) => item.toLowerCase() === lower)) return 'neutral'
  return pluralize.isPlural(lower) ? 'plural' : 'singular'
}

/** 复数词 → 单数（用于把名字统一成多数派的形态）；本来就单数 / 中性时原样返回 */
export function toSingular(word: string): string {
  const lower = word.toLowerCase()
  if (classifyWord(lower) !== 'plural') return lower
  return pluralize.singular(lower)
}

/** 单数词 → 复数；本来就是复数 / 中性时原样返回 */
export function toPlural(word: string): string {
  const lower = word.toLowerCase()
  if (classifyWord(lower) !== 'singular') return lower
  return pluralize.plural(lower)
}
