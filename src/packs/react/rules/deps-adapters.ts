import { fingerprintsOf } from '../../../data/kit-fingerprints.js'
import type { Adapter } from '../../../engine/types.js'
import { wheelFingerprints } from '../../../data/wheel-fingerprints.js'
import { createRule } from '../../../engine/rule.js'
import { knownIconPackages } from '../../../data/icon-packages.js'
import type { Facts, Finding, Rule } from '../../../engine/types.js'

/**
 * 依赖域（P）的「适配表纪律」：适配器是数据，但它必须与项目真实依赖一致。
 *   - P04 一致性：适配表声明的包要在 package.json 里；装了适配表之外的组件库即报
 *   - P05 图标来源唯一：图标 import 只许来自适配器登记的图标包
 *   - P07 疑似自造轮子：弱语法指纹 + 命名指纹（同一能力两类证据同时成立才报，单条不报）
 *
 * 判定等级：清单类 L1（package.json 是确定事实），形态类 L2（单文件事实 + 全项目 import 集合）。
 */

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

/** import 语句里的包名（@scope/x、x/sub 归一化到包） */
function packageOf(spec: string): string {
  const parts = spec.split('/')
  return spec.startsWith('@') ? parts.slice(0, 2).join('/') : (parts[0] ?? spec)
}

/**
 * 适配器声明的包名 = `packages` ∪ `from`（i18n 适配器把库名放在 `from` 里）。
 * 只读数据，不做判定。
 */
function adapterPackagesOf(adapter: Adapter): string[] {
  const spec = adapter as { packages?: string[]; from?: string[] }
  return [...(spec.packages ?? []), ...(spec.from ?? [])]
}

/** P04 适配表与实际依赖一致：声明了要装，装了要登记（反向用 kit 指纹表判定） */
export const adapterDepsConsistent: Rule = createRule({
  id: 'P04',
  domain: 'deps',
  level: 'L1',
  severity: 'error',
  title: '适配表与实际依赖一致',
  hint: '适配表是「项目用什么组件库」的唯一声明：声明的包要装，装了的组件库要登记；换库改适配器，不是改 package.json',
  run: (ctx) => {
    if (!ctx.deps.hasManifest) return []
    const out: Finding[] = []
    const owned: string[] = []

    // 正向：适配表声明的包必须在 package.json 里
    for (const adapter of Object.values(ctx.config.adapters)) {
      for (const pkg of adapterPackagesOf(adapter)) {
        owned.push(pkg)
        if (ctx.deps.declared.has(pkg)) continue
        out.push(
          finding(
            'P04',
            'package.json',
            1,
            `适配表里的 ${pkg} 没有在 package.json 声明（适配器：${adapter.id}）`,
            `把 ${pkg} 加进 dependencies，或从适配器 ${adapter.id} 的 packages 里删掉`,
            true,
          ),
        )
      }
    }

    // 反向：装了适配表之外的组件库 = 两套组件库并存 / 换库没换干净
    for (const kit of fingerprintsOf(owned)) {
      for (const pkg of kit.packages) {
        if (!ctx.deps.declared.has(pkg)) continue
        out.push(
          finding(
            'P04',
            'package.json',
            1,
            `装了适配表之外的组件库 ${pkg}（属于 ${kit.id}）`,
            '换库要改适配器（presets/ui-kits 里的那一份），别让两套组件库并存',
            true,
          ),
        )
      }
    }

    return out
  },
})

/** P05 图标来源唯一：图标 import 只许来自适配器登记的图标包 */
export const iconSourceSingle: Rule = createRule({
  id: 'P05',
  domain: 'deps',
  level: 'L2',
  severity: 'error',
  title: '图标来源唯一',
  requires: ['uiKit.icons'],
  hint: '图标只从适配器登记的图标包 import；要换图标库就改适配器，别在页面里混用',
  run: (ctx) => {
    const adapter = Object.values(ctx.config.adapters).find((item) => item.facet === 'ui-kit') as
      { icons?: { from?: string[] } } | undefined
    const allowed = adapter?.icons?.from ?? []
    const allowedSet = new Set(allowed)
    const out: Finding[] = []

    for (const record of ctx.records) {
      const facts = ctx.facts.get(record.rel)
      if (!facts) continue
      for (const item of facts.imports) {
        const pkg = packageOf(item.spec)
        if (!knownIconPackages.includes(pkg) || allowedSet.has(pkg)) continue
        out.push(
          finding(
            'P05',
            record.rel,
            item.line,
            `图标来自未登记的包：${pkg}`,
            `改用适配器登记的图标包：${allowed.join(' / ')}`,
          ),
        )
      }
    }

    return out
  },
})

/** 把注释区间遮罩成空格（保留换行）：弱指纹只认代码，注释里写到的轮子不算 */
function maskComments(text: string, facts: Facts): string {
  if (facts.comments.length === 0) return text
  const chars = [...text]
  for (const comment of facts.comments) {
    for (let index = comment.pos; index < comment.end; index += 1) {
      if (chars[index] !== '\n') chars[index] = ' '
    }
  }
  return chars.join('')
}

/** 命名指纹：导出名 / 函数名与库 API 名重合（default / * 不算） */
function namingHit(facts: Facts, apiNames: string[]): { name: string; line: number } | null {
  const wanted = new Set(apiNames.map((name) => name.toLowerCase()))
  const candidates = [
    ...facts.exports.map((entry) => ({ name: entry.name, line: entry.line })),
    ...facts.functions.map((entry) => ({ name: entry.name, line: entry.line })),
  ]
  for (const candidate of candidates) {
    if (candidate.name === 'default' || candidate.name === '*') continue
    if (wanted.has(candidate.name.toLowerCase())) return candidate
  }
  return null
}

/**
 * P07 疑似自造轮子：同一能力同时命中「弱语法指纹」与「命名指纹」才报（warn）。
 * 单条弱证据不报 —— 正常业务里的 setTimeout 防抖 UI 不该被误伤（见 .scratch/wheel-detection/spec.md）。
 */
export const wheelSuspected: Rule = createRule({
  id: 'P07',
  domain: 'deps',
  level: 'L2',
  severity: 'warn',
  title: '疑似自造轮子',
  hint: '自研模块与成熟库 API 同名，且文件里已经出现该能力的弱语法指纹：优先用登记方案，别自己实现一遍',
  run: (ctx) => {
    const out: Finding[] = []
    for (const record of ctx.records) {
      const facts = ctx.facts.get(record.rel)
      const source = ctx.sourceOf(record.rel)
      if (!facts || !source) continue
      const lines = maskComments(source, facts).split('\n')

      for (const entry of wheelFingerprints) {
        const softSyntax = entry.softSyntax ?? []
        const apiNames = entry.apiNames ?? []
        // 两类证据缺一不可：没有弱指纹的能力（如 deep-clone）不参与 P07
        if (softSyntax.length === 0 || apiNames.length === 0) continue

        const regexes = softSyntax.map((pattern) => new RegExp(pattern))
        let weakLine = 0
        for (const [index, line] of lines.entries()) {
          if (regexes.some((regex) => regex.test(line))) {
            weakLine = index + 1
            break
          }
        }
        if (weakLine === 0) continue

        const naming = namingHit(facts, apiNames)
        if (!naming) continue
        out.push(
          finding(
            'P07',
            record.rel,
            naming.line,
            `疑似自造轮子：${entry.capability}（第 ${weakLine} 行有弱指纹，且自研了 ${naming.name}）`,
            entry.hint,
          ),
        )
      }
    }
    return out
  },
})

/* ---------------- P11 适配表声明的库必须真的被用 ---------------- */

/**
 * 声明了 ui-kit 适配表（如 `antdKit()`），但项目里既没 import 它声明的任何包、也没有任何 vendor
 * 选择器/变量 → D10 / D10b / P05 / H06 全在空转，而门禁显示"通过"。
 *
 * 与 P04 的分工：P04 管「声明了要装、装了要登记」（清单一致性，error）；
 * P11 管「装了要真的用得上」（事实存在性，warn）。同族的还有 C07（i18n 零资源）与 D21（设计系统零路径）。
 */
export const adapterActuallyUsed: Rule = createRule({
  id: 'P11',
  domain: 'deps',
  level: 'L2',
  severity: 'warn',
  title: '适配表声明的库必须真的被用',
  requires: ['uiKit.packages'],
  hint: '确认 uiKit() 配的是不是本项目真在用的库；不用组件库就用 uiKit(none())，相关规则会进 skipped 明列而不是空转',
  run: (ctx) => {
    const adapter = Object.values(ctx.config.adapters).find((item) => item.facet === 'ui-kit') as
      | { id: string; packages?: string[]; vendorSelectors?: string[]; vendorVars?: string[] }
      | undefined
    const packages = adapter?.packages ?? []
    if (packages.length === 0) return []
    // ① TS 侧：有没有 import 它声明的包
    if (packages.some((pkg) => ctx.graph.externals.has(pkg))) return []
    // ② CSS 侧：有没有出现它声明的 vendor 选择器 / 变量前缀（有项目只在样式里用组件库）
    const patterns = [...(adapter?.vendorSelectors ?? []), ...(adapter?.vendorVars ?? [])]
    const usedInCss =
      patterns.length > 0 &&
      patterns.some((pattern) => {
        const regex = new RegExp(pattern)
        return ctx.records.some((record) => {
          if (record.kind !== 'css') return false
          const text = ctx.sourceOf(record.rel)
          return text !== undefined && regex.test(text)
        })
      })
    if (usedInCss) return []
    return [
      finding(
        'P11',
        'package.json',
        1,
        `适配表声明了 ${packages.join('、')}，但全项目零使用：D10 / D10b / P05 / H06 这几条等于没跑`,
        '确认 uiKit() 配的是不是本项目真在用的库；不用组件库就用 uiKit(none())',
      ),
    ]
  },
})

export const adapterRules: Rule[] = [
  adapterDepsConsistent,
  iconSourceSingle,
  wheelSuspected,
  adapterActuallyUsed,
]
