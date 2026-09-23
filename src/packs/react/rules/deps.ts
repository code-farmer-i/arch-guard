import { wheelFingerprints } from '../../../data/wheel-fingerprints.js'
import type { Facts, Finding, Rule } from '../../../engine/types.js'

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

/** P01 新增依赖必须登记：**没登记 = 没批准**（只在项目声明了白名单/能力表时启用） */
export const depsAllowlist: Rule = {
  id: 'P01',
  domain: 'deps',
  level: 'L1',
  severity: 'error',
  title: '运行时依赖必须登记',
  hint: '把包加进 arch.config.mjs 的 deps({ allow }) 或登记为某能力的首选方案；devDependencies 不受此限',
  run: (ctx) => {
    if (!ctx.deps.hasManifest) return []
    const { allow, capabilities, deny } = ctx.policy
    const approved = new Set([...allow, ...Object.values(capabilities)])
    if (approved.size === 0) return [] // 没声明白名单就不进入 fail-closed 模式
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

/** P02 明确禁用库 */
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

/** P03 幽灵依赖：import 了却没在任何 dependencies 段声明 */
export const phantomDeps: Rule = {
  id: 'P03',
  domain: 'deps',
  level: 'L3',
  severity: 'error',
  title: '幽灵依赖',
  hint: '要么把它写进 package.json，要么删掉这个 import（依赖能跑起来只是运气）',
  run: (ctx) =>
    (ctx.deps.hasManifest ? ctx.deps.phantom : []).map((name) =>
      finding('P03', 'package.json', 1, `import 了未声明的包：${name}`, undefined, true),
    ),
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
  capability: string,
): FingerprintHit[] {
  const entry = wheelFingerprints.find((item) => item.capability === capability)
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
 * 平台内置类能力（structuredClone / Intl / crypto.randomUUID / URLSearchParams）只要命中就报。
 * `allowOwn: true` 的能力降级为 warn（有些小工具自研合理）。
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
    for (const [capability, preferred] of Object.entries(ctx.policy.capabilities)) {
      const entry = wheelFingerprints.find((item) => item.capability === capability)
      if (!entry) continue
      const hits = scanStrongFingerprints(ctx, capability)
      if (hits.length === 0) continue
      // 按**文件**判定：这个文件自己有没有在用登记方案。
      // 用全项目判定会放过「部分迁移」（A 文件用了 dayjs、B 文件还在手搓）。
      const fileUsesPreferred = (file: string): boolean => {
        if (entry.platform === true) return true
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
        if (entry.allowOwn === true) findingEntry.hint = `${entry.hint}（该能力允许自研，仅提示）`
        out.push(findingEntry)
      }
    }
    return out
  },
}

/** P08 登记库必须真的被用：能力首选方案已声明却零引用（死依赖） */
export const capabilityUnused: Rule = {
  id: 'P08',
  domain: 'deps',
  level: 'L3',
  severity: 'warn',
  title: '登记方案未被使用',
  hint: '要么用起来，要么从能力表里去掉',
  run: (ctx) => {
    if (!ctx.deps.hasManifest) return []
    const out: Finding[] = []
    for (const [capability, preferred] of Object.entries(ctx.policy.capabilities)) {
      const entry = wheelFingerprints.find((item) => item.capability === capability)
      if (entry?.platform === true) continue
      if (!ctx.deps.declared.has(preferred)) continue
      if (ctx.deps.imported.has(preferred)) continue
      out.push(
        finding(
          'P08',
          'package.json',
          1,
          `能力 ${capability} 登记了 ${preferred}，但全项目没有任何引用`,
          entry?.hint,
          true,
        ),
      )
    }
    return out
  },
}

export const depsRules: Rule[] = [
  depsAllowlist,
  depsDenied,
  phantomDeps,
  capabilityPreferred,
  capabilityUnused,
]
