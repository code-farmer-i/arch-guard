import { createRule } from '../../../engine/rule.js'
import type { CallFact, DetachedApi, Finding, Rule } from '../../../engine/types.js'

/**
 * 反退化域（H）续：上下文纪律、假异步、硬编码地址、假数据、手搓时间格式化。
 * 全部基于单文件事实（calls / strings），判定等级 L2。
 */

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

/** import 语句里的包名（@scope/x、x/sub 归一化到包） */
function packageOf(spec: string): string {
  const parts = spec.split('/')
  return spec.startsWith('@') ? parts.slice(0, 2).join('/') : (parts[0] ?? spec)
}

/* ---------------- H06 脱离上下文的全局 API ---------------- */

/**
 * H06：适配器登记的成员被**静态**调用即报（`message.success` / `notification.error` / `Modal.confirm`）。
 * 只在文件确实从该库 import 了的时候判 —— 用 `App.useApp()` 取到的实例是上下文内用法，形态上无法靠 callee 区分，
 * 但「没 import 过静态成员」是确定性事实。提示直接给适配器里的 suggest。
 */
export const noDetachedApis: Rule = createRule({
  id: 'H06',
  domain: 'hygiene',
  level: 'L2',
  severity: 'error',
  title: '脱离上下文的全局 API',
  requires: ['uiKit.detachedApis'],
  hint: '改用上下文内用法（组件库适配器的 detachedApis.suggest 给了替代写法），静态方法不继承主题与 locale 上下文',
  run: (ctx) => {
    const adapter = Object.values(ctx.config.adapters).find((item) => item.facet === 'ui-kit') as
      { detachedApis?: DetachedApi[] } | undefined
    const groups = adapter?.detachedApis ?? []
    if (groups.length === 0) return []

    const out: Finding[] = []
    for (const record of ctx.records) {
      const facts = ctx.facts.get(record.rel)
      if (!facts) continue
      const imported = new Set(facts.imports.map((item) => packageOf(item.spec)))

      for (const group of groups) {
        if (!group.from.some((pkg) => imported.has(pkg))) continue
        for (const call of facts.calls) {
          const member = group.members.find(
            (name) => call.callee === name || call.callee.startsWith(`${name}.`),
          )
          if (!member) continue
          out.push(
            finding(
              'H06',
              record.rel,
              call.line,
              `脱离上下文的全局调用：${call.callee}`,
              group.suggest,
            ),
          )
        }
      }
    }
    return out
  },
})

/* ---------------- H07 假异步与随机 ---------------- */

const TIMER_CALLEES = new Set([
  'setTimeout',
  'setInterval',
  'window.setTimeout',
  'window.setInterval',
  'globalThis.setTimeout',
  'globalThis.setInterval',
])

/** 回调形态：箭头函数 / function / 具名函数引用（`setTimeout(fn, 500)` 也算） */
const CALLBACK_START =
  /^(?:async\s+)?(?:function\b|\([^)]*\)\s*=>|[A-Za-z_$][\w$.]*\s*=>|[A-Za-z_$][\w$.]*$)/

/** 行号 → 该行首字符在源码里的偏移；找不到返回 -1 */
function lineStart(source: string, line: number): number {
  let index = 0
  for (let current = 1; current < line; current += 1) {
    const next = source.indexOf('\n', index)
    if (next < 0) return -1
    index = next + 1
  }
  return index
}

/** 从 '(' 起找第一个顶层逗号（跳过字符串与嵌套括号）；找不到返回 -1 */
function topLevelComma(source: string, open: number): number {
  let depth = 0
  let quote = ''
  for (let index = open; index < source.length; index += 1) {
    const char = source.charAt(index)
    if (quote) {
      if (char === '\\') {
        index += 1
        continue
      }
      if (char === quote) quote = ''
      continue
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char
      continue
    }
    if (char === '(' || char === '[' || char === '{') depth += 1
    else if (char === ')' || char === ']' || char === '}') {
      depth -= 1
      if (depth === 0) return -1
    } else if (char === ',' && depth === 1) return index
  }
  return -1
}

/** 假异步的简化判据：定时器调用 + 第一参数是函数 + 第二参数是数字字面量 */
function isFakeAsync(source: string, call: CallFact): boolean {
  const at = source.indexOf(call.callee, Math.max(lineStart(source, call.line), 0))
  if (at < 0) return false
  const open = source.indexOf('(', at + call.callee.length)
  if (open < 0) return false
  const comma = topLevelComma(source, open)
  if (comma < 0) return false
  if (!CALLBACK_START.test(source.slice(open + 1, comma).trim())) return false
  return /^\d/.test(source.slice(comma + 1).trimStart())
}

/** H07 假异步与随机：用定时器假装请求、用 Math.random 假装随机 */
export const noFakeAsync: Rule = createRule({
  id: 'H07',
  domain: 'hygiene',
  level: 'L2',
  severity: 'error',
  title: '假异步与随机',
  hint: '假异步换成真实请求/后端契约；随机数用平台内置 crypto.randomUUID() 或服务端生成，别用 Math.random 造数据',
  run: (ctx) => {
    const out: Finding[] = []
    for (const record of ctx.records) {
      const facts = ctx.facts.get(record.rel)
      if (!facts) continue
      const source = ctx.sourceOf(record.rel)
      for (const call of facts.calls) {
        if (call.callee === 'Math.random') {
          out.push(
            finding(
              'H07',
              record.rel,
              call.line,
              '假随机：Math.random()',
              '改用 crypto.randomUUID()',
            ),
          )
          continue
        }
        if (!TIMER_CALLEES.has(call.callee)) continue
        if (!source || !isFakeAsync(source, call)) continue
        out.push(
          finding(
            'H07',
            record.rel,
            call.line,
            `假异步：用 ${call.callee} 固定等待`,
            '等待固定毫秒只是掩盖竞态；改成真实的 Promise / 事件 / 轮询',
          ),
        )
      }
    }
    return out
  },
})

/* ---------------- H08 硬编码地址 ---------------- */

const ADDRESS = /https?:\/\/|localhost|127\.0\.0\.1/
const DEFAULT_ENV_FILE = 'src/shared/config/env.ts'

/** H08 硬编码地址：源码里写死 http(s):// / localhost / 127.0.0.1 */
export const noHardcodedAddress: Rule = createRule({
  id: 'H08',
  domain: 'hygiene',
  level: 'L2',
  severity: 'error',
  title: '硬编码地址',
  hint: '地址只放在集中配置里（默认 src/shared/config/env.ts，可用 params.envFile 改），业务代码从配置读，别散着写死',
  run: (ctx) => {
    const raw = ctx.config.params.envFile
    const envFile = (typeof raw === 'string' ? raw : DEFAULT_ENV_FILE).replace(/^\.\//, '')
    const out: Finding[] = []

    for (const record of ctx.records) {
      // 环境配置文件是地址的唯一出处；测试文件与 package.json 不在判定范围内
      if (record.rel === envFile || /\.test\.[^/]+$/.test(record.rel)) continue
      const facts = ctx.facts.get(record.rel)
      if (!facts) continue
      for (const entry of facts.strings) {
        if (!ADDRESS.test(entry.value)) continue
        out.push(
          finding(
            'H08',
            record.rel,
            entry.line,
            `硬编码地址：${entry.value.slice(0, 60)}`,
            '从环境配置读地址（如 import.meta.env），别把地址写进业务代码',
          ),
        )
      }
    }

    return out
  },
})

/* ---------------- H09 静默假数据 ---------------- */

const FAKE_WORDS = ['mock', 'fake', 'dummy', 'lorem']

/**
 * mock / fake / dummy / lorem 判定：大小写不敏感，且要求是独立词或 camelCase 词首
 * （`mockUser` / `dummy-user` 命中，`mockingbird` / `myMockThing` 不命中）。
 */
function hasFakeData(text: string): boolean {
  const lower = text.toLowerCase()
  return FAKE_WORDS.some((word) => {
    let from = 0
    for (;;) {
      const at = lower.indexOf(word, from)
      if (at < 0) return false
      const before = text.charAt(at - 1)
      const after = text.charAt(at + word.length)
      const beforeOk = before === '' || !/[A-Za-z]/.test(before)
      if (beforeOk && !/[a-z]/.test(after)) return true
      from = at + 1
    }
  })
}

/** H09 静默假数据：源码里留下 mock/fake/dummy/lorem 的标识符（字符串值与调用名；注释不进 facts） */
export const noSilentMockData: Rule = createRule({
  id: 'H09',
  domain: 'hygiene',
  level: 'L2',
  severity: 'warn',
  title: '静默假数据',
  hint: '假数据只许出现在测试/夹具里；业务代码删掉 mock 分支，数据从 API 层来',
  run: (ctx) => {
    const out: Finding[] = []
    for (const record of ctx.records) {
      const facts = ctx.facts.get(record.rel)
      if (!facts) continue
      for (const entry of facts.strings) {
        if (!hasFakeData(entry.value)) continue
        out.push(
          finding(
            'H09',
            record.rel,
            entry.line,
            `疑似假数据字面量：${entry.value.slice(0, 40)}`,
            '删掉假数据或移到 __fixtures__ / 测试里',
          ),
        )
      }
      for (const call of facts.calls) {
        if (!hasFakeData(call.callee)) continue
        out.push(
          finding(
            'H09',
            record.rel,
            call.line,
            `疑似假数据调用：${call.callee}`,
            '删掉假数据或移到 __fixtures__ / 测试里',
          ),
        )
      }
    }
    return out
  },
})

/* ---------------- H10 手搓时间格式化 ---------------- */

const HANDROLLED_DATE = [
  /\.toLocaleDateString$/,
  /\.toLocaleTimeString$/,
  /\.toLocaleString$/,
  /^Intl\.DateTimeFormat$/,
  /\.get(FullYear|Month|Date|Hours|Minutes)$/,
]

/** H10 手搓时间格式化：locale API / Intl / 手动取日期分量，一律改用登记的日期库 */
export const noHandrolledDateFormat: Rule = createRule({
  id: 'H10',
  domain: 'hygiene',
  level: 'L2',
  severity: 'warn',
  title: '手搓时间格式化',
  hint: '改用项目已登记的日期库（能力表 datetime 的首选方案），手拼格式会漏时区与 locale',
  run: (ctx) => {
    const out: Finding[] = []
    for (const record of ctx.records) {
      const facts = ctx.facts.get(record.rel)
      if (!facts) continue
      for (const call of facts.calls) {
        if (!HANDROLLED_DATE.some((regex) => regex.test(call.callee))) continue
        out.push(
          finding(
            'H10',
            record.rel,
            call.line,
            `手搓时间格式化：${call.callee}`,
            '用登记日期库的 format / add / diff，别手取年月日再拼串',
          ),
        )
      }
    }
    return out
  },
})

export const contextHygieneRules: Rule[] = [
  noDetachedApis,
  noFakeAsync,
  noHardcodedAddress,
  noSilentMockData,
  noHandrolledDateFormat,
]
