import { globToRegExp } from '../../../engine/util.js'
import type { Finding, Rule } from '../../../engine/types.js'

import { finding } from './structure-util.js'

/**
 * 「**形态 + 落点**」一族的纪律规则（见 `.scratch/state-auth-discipline/spec.md`）：
 *
 * - **S41 状态单元只在声明的落点**：导出名命中 `structure.clientState[].naming` 的文件必须在 `in` 里。
 *   只比导出名，不猜"这是不是状态" —— 所以零误伤的前提是项目把命名契约定下来。
 * - **S42 跳转守卫只在声明的落点**：字符串实参 / JSX `to` 命中登录路径的"跳登录"动作，
 *   只许出现在 `structure.authRedirects.in` 里。**不数"重复了几遍"**（语义比对必然误伤）。
 *
 * 权限判断（R-46）不在这里 —— 它复用 S38 的 `callSites([{ name, apis, in }])`：同一族场景同一套声明。
 */

const matches = (globs: string[], rel: string): boolean =>
  globs.some((glob) => globToRegExp(glob).test(rel))

/* ---------------- S41 状态单元只在声明的落点 ---------------- */

export const clientStateUnits: Rule = {
  id: 'S41',
  domain: 'structure',
  level: 'L2',
  severity: 'error',
  title: '状态单元只在声明的落点',
  hint: '客户端状态统一放在项目声明的落点里（域内 stores/ 或 shared/stores）：散在 hooks / 页面里，新人不知道跟哪套',
  run: (ctx) => {
    const specs = ctx.config.structure.clientState ?? []
    if (specs.length === 0) return []
    const out: Finding[] = []
    for (const spec of specs) {
      const naming = globToRegExp(spec.naming)
      for (const record of ctx.records) {
        if (matches(spec.in, record.rel)) continue
        const facts = ctx.facts.get(record.rel)
        if (!facts) continue
        for (const exported of facts.exports) {
          if (exported.name === 'default' || exported.name === '*') continue
          if (!naming.test(exported.name)) continue
          out.push(
            finding(
              'S41',
              record.rel,
              exported,
              `${exported.name} 看起来是客户端状态单元，但不在声明的落点里（${spec.in.join(' / ')}）`,
              '把状态挪到声明的落点；只读它（消费）不受影响 —— 这条只管**定义在哪**',
            ),
          )
        }
      }
    }
    return out
  },
}

/* ---------------- S42 跳转守卫只在声明的落点 ---------------- */

export const authRedirects: Rule = {
  id: 'S42',
  domain: 'structure',
  level: 'L2',
  severity: 'error',
  title: '跳转守卫只在声明的落点',
  hint: '"未登录跳登录"只写一次（放在声明的守卫落点），别在每个页面各写一遍 —— 写法会越走越散',
  run: (ctx) => {
    const spec = ctx.config.structure.authRedirects
    if (!spec || spec.loginPaths.length === 0) return []
    const loginPaths = new Set(spec.loginPaths)
    const out: Finding[] = []
    for (const record of ctx.records) {
      if (matches(spec.in, record.rel)) continue
      const facts = ctx.facts.get(record.rel)
      if (!facts) continue
      // ① 调用形态：navigate('/login') / router.push('/login') / redirect('/login')
      for (const call of facts.calls) {
        if (call.stringArg === undefined || !loginPaths.has(call.stringArg)) continue
        out.push(
          finding(
            'S42',
            record.rel,
            call,
            `${call.callee}(${JSON.stringify(call.stringArg)}) 是跳登录，只许出现在守卫落点（${spec.in.join(' / ')}）`,
            '把这道守卫交给声明的守卫组件/钩子，页面只管渲染',
          ),
        )
      }
      // ② JSX 形态：<Navigate to="/login" />（`to` / `href` 属性）
      for (const text of facts.strings) {
        if (text.prop !== 'to' && text.prop !== 'href') continue
        if (!loginPaths.has(text.value)) continue
        out.push(
          finding(
            'S42',
            record.rel,
            text,
            `${text.prop}="${text.value}" 是跳登录，只许出现在守卫落点（${spec.in.join(' / ')}）`,
            '把这道守卫交给声明的守卫组件/钩子，页面只管渲染',
          ),
        )
      }
    }
    return out
  },
}

export const structureDisciplineRules: Rule[] = [clientStateUnits, authRedirects]
