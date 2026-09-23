import type { Finding, Rule, RuleContext } from '../../../engine/types.js'

/**
 * 文案域（C）：写死文案、键存在性、多语言一致、命名空间分片、聚合入口、死键。
 * 资源由 i18n 适配器声明（`copy()` 预设），没声明时规则会出现在 skipped 里，不静默失能。
 */

interface I18nAdapter {
  resourceDir?: string
  fn?: string
}

/** 中日韩统一表意文字：JSX 里出现即视为写死文案 */
const CJK = /[\u3400-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]/

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

const adapterOf = (ctx: RuleContext): I18nAdapter | undefined =>
  ctx.config.adapters.i18n as I18nAdapter | undefined

const fnOf = (ctx: RuleContext): string => adapterOf(ctx)?.fn ?? 't'
const dirOf = (ctx: RuleContext): string => adapterOf(ctx)?.resourceDir ?? 'src/shared/i18n/locales'
const isResource = (rel: string, dir: string): boolean => rel.startsWith(`${dir}/`)
const isTranslationCall = (callee: string, fn: string): boolean =>
  callee === fn || callee.endsWith(`.${fn}`)
/**
 * `labelKey: 'nav.crews'` 这类属性名也是键引用。
 * **必须排除裸 `key`**：`key: 'logout'` 是 React 的列表 key、`cssVar: { key }` 是 antd 的变量名，
 * 都不是文案键（实测在 superhive 上一次误报 16 条）。
 */
const isKeyProp = (prop: string | null): boolean =>
  prop !== null && prop !== 'key' && /Key$/.test(prop)

/* ---------------- C01 JSX 里不写死文案 ---------------- */

export const noHardText: Rule = {
  id: 'C01',
  domain: 'copy',
  level: 'L2',
  severity: 'error',
  title: 'JSX 里不写死文案',
  requires: ['i18n.resourceDir'],
  hint: "文案走 t('命名空间.键')：写死的文案翻不了，也进不了文案门禁",
  run: (ctx) => {
    const dir = dirOf(ctx)
    const fn = fnOf(ctx)
    const out: Finding[] = []
    for (const record of ctx.records) {
      if (record.kind !== 'ts' || isResource(record.rel, dir)) continue
      const facts = ctx.facts.get(record.rel)
      if (!facts) continue
      // 只要求「本来就在用 t()」的文件：完全没走 i18n 的文件是另一个决定（整体迁移），
      // 报出来只是噪音，该不该迁由宿主在 enable 里表达。
      const usesT = facts.calls.some((call) => isTranslationCall(call.callee, fn))
      if (!usesT) continue
      for (const text of facts.jsxText) {
        if (CJK.test(text.value))
          out.push(finding('C01', record.rel, text.line, `写死文案：${text.value.slice(0, 30)}`))
      }
    }
    return out
  },
}

/* ---------------- C02 / C06 键的存在性与使用 ---------------- */

interface KeyUsage {
  used: Set<string>
  /** 动态键的静态前缀（t(`nav.${x}`) → "nav."）：这些前缀下的键无法判定，不算死键 */
  prefixes: string[]
  queries: { rel: string; line: number; key: string }[]
}

function collectUsages(ctx: RuleContext): KeyUsage {
  const dir = dirOf(ctx)
  const fn = fnOf(ctx)
  const used = new Set<string>()
  const prefixes: string[] = []
  const queries: KeyUsage['queries'] = []
  for (const record of ctx.records) {
    if (record.kind !== 'ts' || isResource(record.rel, dir)) continue
    const facts = ctx.facts.get(record.rel)
    if (!facts) continue
    for (const call of facts.calls) {
      if (!isTranslationCall(call.callee, fn)) continue
      if (call.keyPrefix) prefixes.push(call.keyPrefix)
      if (!call.stringArg) continue
      used.add(call.stringArg)
      queries.push({ rel: record.rel, line: call.line, key: call.stringArg })
    }
    for (const literal of facts.strings) {
      if (!isKeyProp(literal.prop)) continue
      used.add(literal.value)
      queries.push({ rel: record.rel, line: literal.line, key: literal.value })
    }
  }
  return { used, prefixes, queries }
}

export const keysMustExist: Rule = {
  id: 'C02',
  domain: 'copy',
  level: 'L3',
  severity: 'error',
  title: '文案键必须存在',
  requires: ['i18n.resourceDir'],
  hint: '键写错时界面上会直接显示键名，用户一眼能看到；按资源文件里的真实键改',
  run: (ctx) => {
    const index = ctx.i18n
    if (!index || index.files.length === 0) return []
    const known = new Set(index.files.flatMap((file) => file.keys.map((key) => key.path)))
    const { queries } = collectUsages(ctx)
    const out: Finding[] = []
    for (const query of queries) {
      if (query.key.includes('${')) continue
      if (!known.has(query.key))
        out.push(finding('C02', query.rel, query.line, `文案键不存在：${query.key}`))
    }
    return out
  },
}

export const noDeadKeys: Rule = {
  id: 'C06',
  domain: 'copy',
  level: 'L3',
  severity: 'warn',
  title: '无死键',
  requires: ['i18n.resourceDir'],
  hint: '没人用的文案键是死数据；动态拼接的键无法判定，所以这条只给 warn',
  run: (ctx) => {
    const index = ctx.i18n
    if (!index || index.files.length === 0) return []
    const { used, prefixes } = collectUsages(ctx)
    const out: Finding[] = []
    for (const file of index.files) {
      if (file.isEntry) continue
      for (const key of file.keys) {
        if (used.has(key.path)) continue
        // 有动态拼接（t(`pages.dashboard.${x}`)）时，该前缀下的键无法判定，不判死
        if (prefixes.some((prefix) => key.path.startsWith(prefix))) continue
        out.push(finding('C06', file.rel, key.line, `未被引用的文案键：${key.path}`))
        if (out.length >= 20) return out
      }
    }
    return out
  },
}

/* ---------------- C03 多语言键一致 ---------------- */

export const languageParity: Rule = {
  id: 'C03',
  domain: 'copy',
  level: 'L3',
  severity: 'error',
  title: '多语言键必须一致',
  requires: ['i18n.resourceDir'],
  hint: '缺键的那门语言会直接显示键名；两边一起改',
  run: (ctx) => {
    const index = ctx.i18n
    if (!index || index.languages.length < 2) return []
    const union = new Set(index.files.flatMap((file) => file.keys.map((key) => key.path)))
    const out: Finding[] = []
    for (const language of index.languages) {
      const keys = new Set(
        index.files
          .filter((file) => file.language === language)
          .flatMap((file) => file.keys.map((key) => key.path)),
      )
      const entry = index.files.find((file) => file.language === language && file.isEntry)?.rel
      const anchor = entry ?? `${index.resourceDir}/${language}/index.ts`
      for (const key of union) {
        if (!keys.has(key)) out.push(finding('C03', anchor, 1, `${language} 缺少文案键：${key}`))
      }
    }
    return out
  },
}

/* ---------------- C04 一个文件一个命名空间 ---------------- */

export const oneNamespacePerFile: Rule = {
  id: 'C04',
  domain: 'copy',
  level: 'L2',
  severity: 'error',
  title: '一个文件一个命名空间',
  requires: ['i18n.resourceDir'],
  hint: '分片按命名空间切；同一份文案出现在两个命名空间里，改一处漏一处',
  run: (ctx) => {
    const index = ctx.i18n
    if (!index) return []
    /** 某语言某命名空间下的叶子键名 */
    const leavesOf = (language: string, namespace: string): Set<string> =>
      new Set(
        index.files
          .filter((item) => item.language === language && item.namespace === namespace)
          .flatMap((item) => item.keys.map((key) => key.path.split('.').pop() as string)),
      )
    const out: Finding[] = []
    for (const language of index.languages) {
      const namespaces = new Set(
        index.files
          .filter((file) => file.language === language && !file.isEntry)
          .map((file) => file.namespace),
      )
      for (const file of index.files) {
        if (file.language !== language || file.isEntry) continue
        for (const key of file.keys) {
          // 键路径已带本文件命名空间前缀：`mixed.nav.crews` 的第二段才是「是不是另一套命名空间」。
          // 只有叶子键真的重名才算混入 —— 只是分组重名（`crew.space.*`）是正常嵌套。
          const parts = key.path.split('.')
          const head = parts[1]
          const leaf = parts[parts.length - 1] as string
          if (!head || !namespaces.has(head)) continue
          if (!leavesOf(language, head).has(leaf)) continue
          out.push(
            finding(
              'C04',
              file.rel,
              key.line,
              `${file.namespace}.ts 里重复了 ${head} 命名空间：${key.path}`,
            ),
          )
        }
      }
    }
    return out
  },
}

/* ---------------- C05 分片必须被聚合入口引用 ---------------- */

export const shardsAggregated: Rule = {
  id: 'C05',
  domain: 'copy',
  level: 'L3',
  severity: 'error',
  title: '文案分片必须被聚合入口引用',
  requires: ['i18n.resourceDir'],
  hint: '没被 index.ts 引用的分片不会进 i18next 的 resources，界面上就是一堆键名',
  run: (ctx) => {
    const index = ctx.i18n
    if (!index) return []
    const out: Finding[] = []
    for (const file of index.files) {
      if (file.isEntry) continue
      const entry = `${index.resourceDir}/${file.language}/index.ts`
      const imported = ctx.graph.edges.get(entry)?.has(file.rel) ?? false
      if (!imported) out.push(finding('C05', file.rel, 1, `分片未被 ${entry} 引用`))
    }
    return out
  },
}

export const copyRules: Rule[] = [
  noHardText,
  keysMustExist,
  languageParity,
  oneNamespacePerFile,
  shardsAggregated,
  noDeadKeys,
]
