import type { WheelFingerprint } from '../../../data/wheel-fingerprints.js'

import { effectiveFingerprints } from './deps-fingerprints.js'
import type { Facts, Finding, Rule, RuleContext } from '../../../engine/types.js'

const finding = (
  rule: string,
  file: string,
  line: number,
  text: string,
  hint?: string,
  global = false,
): Finding => ({
  rule,
  file,
  line,
  text,
  ...(hint ? { hint } : {}),
  ...(global ? { global: true } : {}),
})

/**
 * 依赖域（P）：管两件事
 *   1. 依赖清单纪律 —— 装了什么（P01 白名单 / P02 禁用 / P03 幽灵依赖）
 *   2. 能力纪律 —— 代码里干了什么活、有没有用登记的方案（P06 / P08）
 *
 * 判定等级：清单类 L1（读 package.json），能力类 L2（单文件形态 + 全项目 import 集合）。
 */

/**
 * 适配表声明的包也算「已批准」：适配器是「项目用什么库」的唯一声明（P04 用同一份数据），
 * 不必在 allow 里重抄一遍。注意它只**并入名单**，不负责打开 P01 —— 开关仍然只有 allow。
 */
function adapterPackages(ctx: RuleContext): string[] {
  const out = new Set<string>()
  for (const adapter of Object.values(ctx.config.adapters)) {
    // `packages` ∪ `from`：i18n 适配器把库名放在 `from` 里（同 deps-adapters 的 helper）
    const spec = adapter as { packages?: string[]; from?: string[] }
    for (const name of [...(spec.packages ?? []), ...(spec.from ?? [])]) out.add(name)
  }
  return [...out]
}

/**
 * P01 新增依赖必须登记：**没登记 = 没批准**。
 *
 * 开关是 `allow`（显式声明才进入 fail-closed）。`capabilities` **不再**隐式开启本规则 ——
 * 否则「只想声明一个能力（datetime → dayjs）」会等价于「批准清单里只有 dayjs」，
 * 项目其余依赖全部报红，而用户并没有要过白名单。能力表只驱动 P06（手搓指纹）。
 * 反重复由 `policyConflicts` 保证：只要 allow 非空，能力首选必须同时登记在 allow 里；
 * 适配表声明的包则由 `adapterPackages()` 自动并入名单。
 */
export const depsAllowlist: Rule = {
  id: 'P01',
  domain: 'deps',
  level: 'L1',
  severity: 'error',
  title: '运行时依赖必须登记',
  hint: '把包加进 arch.config.mjs 的 deps({ allow })，或登记为能力的首选方案 / 适配表里的组件库；devDependencies 不受此限',
  run: (ctx) => {
    if (!ctx.deps.hasManifest) return []
    const { allow, deny } = ctx.policy
    if (allow.length === 0) return [] // 没声明白名单就不进入 fail-closed 模式
    const approved = new Set([...allow, ...adapterPackages(ctx)])
    return (
      ctx.deps.runtime
        // deny 里的库由 P02 报，不在这里重复
        .filter((name) => !approved.has(name) && !deny.includes(name))
        .map((name) =>
          finding('P01', 'package.json', 1, `未登记的运行时依赖：${name}`, undefined, true),
        )
    )
  },
}

/**
 * P02 明确禁用库。
 * 注意：启用 allow 白名单（P01）后，这个规则基本是多余的 —— 未登记的依赖已经被拦下。
 * 保留它只为两种情况：① 项目不想维护白名单，只想表达少数硬禁令；② 想给某个库更明确的报错。
 */
export const depsDenied: Rule = {
  id: 'P02',
  domain: 'deps',
  level: 'L1',
  severity: 'error',
  title: '明确禁用的库',
  hint: '从 package.json 移除；若确需引入，先在配置里把它从 deny 移出并说明理由',
  run: (ctx) => {
    if (!ctx.deps.hasManifest) return []
    const { deny } = ctx.policy
    if (deny.length === 0) return []
    return ctx.deps.runtime
      .filter((name) => deny.includes(name))
      .map((name) => finding('P02', 'package.json', 1, `禁用的依赖：${name}`, undefined, true))
  },
}

interface FingerprintHit {
  file: string
  line: number
}

/** import 语句里的包名（@scope/x、x/sub 归一化到包） */
function packageOf(spec: string): string {
  const parts = spec.split('/')
  return spec.startsWith('@') ? parts.slice(0, 2).join('/') : (parts[0] ?? spec)
}

/** 把注释区间替换成空格（保留换行）：只在真实代码上匹配指纹 */
function maskComments(text: string, facts: Facts | undefined): string {
  if (facts && facts.comments.length > 0) {
    const chars = [...text]
    for (const comment of facts.comments) {
      for (let index = comment.pos; index < comment.end; index += 1) {
        if (chars[index] !== '\n') chars[index] = ' '
      }
    }
    return chars.join('')
  }
  return text.replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '))
}

/** 全项目扫强指纹（数据来自 data/wheel-fingerprints.ts，规则本身不含任何库名） */
function scanStrongFingerprints(
  ctx: Parameters<Rule['run']>[0],
  fingerprints: readonly WheelFingerprint[],
  capability: string,
): FingerprintHit[] {
  const entry = fingerprints.find((item) => item.capability === capability)
  if (!entry?.syntax || entry.syntax.length === 0) return []
  const regexes = entry.syntax.map((pattern) => new RegExp(pattern))
  const hits: FingerprintHit[] = []
  for (const record of ctx.records) {
    if (record.kind !== 'ts' && record.kind !== 'css') continue
    const raw = ctx.sourceOf(record.rel)
    if (!raw) continue
    const lines = maskComments(raw, ctx.facts.get(record.rel)).split('\n')
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index] as string
      if (regexes.some((regex) => regex.test(line)))
        hits.push({ file: record.rel, line: index + 1 })
    }
  }
  return hits
}

/**
 * P06 能力必须用登记方案：命中「手工轮子」强指纹时，必须已经在用该能力的首选方案。
 *
 * 两种能力的豁免方式不同（这里曾经写反，导致 5 个平台能力静默失效）：
 * - **需要依赖的能力**（dayjs / commander / zod…）：看**这个文件**有没有 import 首选方案 ——
 *   按文件判而非按项目判，否则"部分迁移"（A 文件用了、B 文件还在手搓）会被整体放过；
 * - **平台内置能力**（structuredClone / Intl / crypto.randomUUID / URLSearchParams…）：**没有依赖可查，
 *   所以没有豁免** —— 命中就报。别以为"同文件里也用了 structuredClone 就没事"：JSON 深拷贝会丢
 *   Date / Map / undefined，那仍然是个 bug。
 *
 * `allowOwn: true` 的能力（query-string / validation / debounce-throttle）**降级为 warn**：
 * 有些小工具自研是合理的，但"提示"要真的出现在报告里，而不是只往 hint 追加一句话。
 */
export const capabilityPreferred: Rule = {
  id: 'P06',
  domain: 'deps',
  level: 'L2',
  severity: 'error',
  title: '能力必须用登记方案',
  hint: '用能力表里登记的首选方案，别手搓',
  run: (ctx) => {
    const out: Finding[] = []
    // 生效的指纹表 = 内置表 + 本项目覆盖（R-73）；每个能力都查同一份，别再各找一遍
    const fingerprints = effectiveFingerprints(ctx.policy)
    for (const [capability, preferred] of Object.entries(ctx.policy.capabilities)) {
      const entry = fingerprints.find((item) => item.capability === capability)
      if (!entry) continue
      const hits = scanStrongFingerprints(ctx, fingerprints, capability)
      if (hits.length === 0) continue
      // 按**文件**判定：这个文件自己有没有在用登记方案。
      // 用全项目判定会放过「部分迁移」（A 文件用了 dayjs、B 文件还在手搓）。
      const fileUsesPreferred = (file: string): boolean => {
        // 平台内置能力没有 import 可查 → **没有豁免**（返回 false 表示"不算已在用"）。
        // 这里曾经返回 true（语义写反），于是 deep-clone / unique-id / number-format /
        // deep-equal / query-string 五个平台能力**从来没报过**，而没有任何夹具覆盖它们。
        if (entry.platform === true) return false
        const facts = ctx.facts.get(file)
        return facts?.imports.some((item) => packageOf(item.spec) === preferred) === true
      }
      // 每文件只报首个命中行，但把该文件其余命中数带上（否则会以为只有一处）
      const firstHitPerFile = new Map<string, FingerprintHit>()
      for (const hit of hits) if (!firstHitPerFile.has(hit.file)) firstHitPerFile.set(hit.file, hit)
      const hitCountByFile = new Map<string, number>()
      for (const hit of hits) hitCountByFile.set(hit.file, (hitCountByFile.get(hit.file) ?? 0) + 1)

      for (const [file, hit] of firstHitPerFile) {
        if (fileUsesPreferred(file)) continue
        const others = (hitCountByFile.get(file) ?? 1) - 1
        const findingEntry = finding(
          'P06',
          file,
          hit.line,
          `手搓了 ${capability} 的活，但没在用登记的 ${preferred}${others > 0 ? `（该文件另有 ${others} 处）` : ''}`,
          entry.hint,
        )
        if (entry.allowOwn === true) {
          // 数据表说"只提示不报错" → 真的降级（此前只改 hint，finding 仍是 error）
          findingEntry.severity = 'warn'
          findingEntry.hint = `${entry.hint}（该能力允许自研，仅提示）`
        }
        out.push(findingEntry)
      }
    }
    return out
  },
}

export const depsRules: Rule[] = [
  depsAllowlist,
  depsDenied,
  // 幽灵依赖与「登记但未使用」委派给 knip / depcheck
  capabilityPreferred,
]
