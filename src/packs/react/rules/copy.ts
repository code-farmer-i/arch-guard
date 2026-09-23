import type { Finding, Rule, RuleContext } from '../../../engine/types.js'

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

/* ---------------- 共用：翻译调用的判定与「键被引用」的证据 ---------------- */

interface I18nAdapterData {
  fn?: string
  hook?: string
}

/** i18n 适配器里登记的函数名 / hook 名（适配器是数据，规则只读它） */
function i18nAdapterData(ctx: RuleContext): I18nAdapterData {
  return (Object.values(ctx.config.adapters).find((item) => item.facet === 'i18n') ??
    {}) as I18nAdapterData
}

/** 是不是翻译调用：`t(…)` / `i18n.t(…)`（适配器只登记一个函数名，允许带对象前缀） */
const isTranslationCallee = (callee: string, fn: string): boolean =>
  callee === fn || callee.endsWith(`.${fn}`)

/**
 * 文件级命名空间提示：`const { t } = useTranslation('nav')` 之后 `t('crews')` 指的是 `nav.crews`。
 * 不做作用域分析（那要绑定解析），按**文件**取第一个 hook 调用的字面量参数 —— 一个文件里
 * 换命名空间的写法在正常代码里几乎不存在，误判风险远小于"整片键被当成不存在"。
 */
function namespaceHints(ctx: RuleContext, hook: string): Map<string, string> {
  const hints = new Map<string, string>()
  for (const record of ctx.records) {
    const facts = ctx.facts.get(record.rel)
    if (!facts) continue
    for (const call of facts.calls) {
      if (call.callee !== hook && !call.callee.endsWith(`.${hook}`)) continue
      if (call.stringArg) hints.set(record.rel, call.stringArg)
    }
  }
  return hints
}

/** 一个调用点上的键候选：`ns:key`（i18next 显式命名空间）与命名空间式调用都要能对上 */
function keyCandidates(raw: string, namespaceHint: string | undefined): string[] {
  const out: string[] = []
  const colon = raw.indexOf(':')
  if (colon > 0) out.push(`${raw.slice(0, colon)}.${raw.slice(colon + 1)}`)
  out.push(raw)
  // i18next 的默认命名空间叫 translation；它不是分片文件名，不参与拼接
  if (namespaceHint && namespaceHint !== 'translation') out.push(`${namespaceHint}.${raw}`)
  return out
}

/* ---------------- C02 每个 t() 的键必须存在 ---------------- */

export const keysExist: Rule = {
  id: 'C02',
  domain: 'copy',
  level: 'L3',
  severity: 'error',
  title: 't() 的键必须存在',
  requires: ['i18n.resourceDir'],
  hint: '键拼错时界面直接把键名显示给用户；补进 locales，或改回正确的键',
  run: (ctx) => {
    const index = ctx.i18n
    if (!index || index.files.length === 0) return []
    const adapter = i18nAdapterData(ctx)
    const fn = adapter.fn ?? 't'
    const hints = namespaceHints(ctx, adapter.hook ?? 'useTranslation')
    // 键集合取**全部语言的并集**：只缺某一门语言是 C03 的活（它按并集逐语言比对），两个域不重复报同一件事
    const known = new Set(index.files.flatMap((file) => file.keys.map((key) => key.path)))
    const out: Finding[] = []
    for (const record of ctx.records) {
      // locales 自己不是调用点：资源文件里的字面量是**值**，不是对键的引用
      if (record.rel.startsWith(`${index.resourceDir}/`)) continue
      const facts = ctx.facts.get(record.rel)
      if (!facts) continue
      for (const call of facts.calls) {
        if (!isTranslationCallee(call.callee, fn)) continue
        // 动态键（`t(`ns.${x}`)`）不做求值，只按前缀放行；没有字面量参数的调用无法判定
        if (!call.stringArg) continue
        const hit = keyCandidates(call.stringArg, hints.get(record.rel)).some((key) =>
          known.has(key),
        )
        if (hit) continue
        out.push(finding('C02', record.rel, call.line, `文案键不存在：${call.stringArg}`))
      }
    }
    return out
  },
}

/* ---------------- C06 无死键 ---------------- */

export const noDeadKeys: Rule = {
  id: 'C06',
  domain: 'copy',
  level: 'L3',
  severity: 'warn',
  title: '无死键',
  requires: ['i18n.resourceDir'],
  hint: '没人引用的键会一直沉在资源里，改文案时也看不出来它已经下线；确认不用就删掉，别留在"以后可能用"',
  run: (ctx) => {
    const index = ctx.i18n
    if (!index || index.files.length === 0) return []
    const adapter = i18nAdapterData(ctx)
    const fn = adapter.fn ?? 't'
    const hints = namespaceHints(ctx, adapter.hook ?? 'useTranslation')
    const used = new Set<string>()
    const prefixes: string[] = []
    for (const record of ctx.records) {
      if (record.rel.startsWith(`${index.resourceDir}/`)) continue
      const facts = ctx.facts.get(record.rel)
      if (!facts) continue
      // 1) 与键同值的**任何**字面量都算引用：`labelKey: 'common.theme.dark'` 这类常量表是现实写法，
      //    只认 t() 的直接参数会把它们全判成死键（这也是不做绑定解析的代价，靠这条兜住）
      for (const item of facts.strings) used.add(item.value)
      for (const call of facts.calls) {
        if (!isTranslationCallee(call.callee, fn)) continue
        if (call.stringArg) {
          for (const key of keyCandidates(call.stringArg, hints.get(record.rel))) used.add(key)
        }
        // 2) 动态键（模板串）按静态前缀放行：`t(`nav.${x}`)` 之后 nav.* 不算死
        if (call.keyPrefix) prefixes.push(call.keyPrefix)
      }
    }
    const out: Finding[] = []
    for (const file of index.files) {
      if (file.isEntry) continue // 聚合入口自己的键没有意义（见 i18n.ts 的说明）
      for (const key of file.keys) {
        if (used.has(key.path)) continue
        if (prefixes.some((prefix) => key.path.startsWith(prefix))) continue
        out.push(finding('C06', file.rel, key.line, `死键：${key.path}`))
      }
    }
    return out
  },
}

/* ---------------- C07 声明了 i18n 却零资源 ---------------- */

/**
 * 声明了 i18n 能力（`copy()`），但 `resourceDir` 下一个文案文件都没有 → 整片 C 域等于没跑。
 *
 * 为什么必须报：能力协商只保证「**没声明**就不注册」；声明了却没有任何对应事实时，
 * C02–C06 会安静地遍历空集合，门禁显示"通过" —— 这正是「以为在跑、其实没跑」。
 * 同族的设计是 P08（登记库必须真的被用），但它按 docs/DESIGN.md §4.9 委派给了 knip，
 * 所以 i18n 这一面由 C 域自己把洞补上。
 */
export const i18nResourcesExist: Rule = {
  id: 'C07',
  domain: 'copy',
  level: 'L1',
  severity: 'warn',
  title: '声明了 i18n 就必须真有文案资源',
  requires: ['i18n.resourceDir'],
  hint: '确认 copy() 里的 resourceDir 写对了；项目确实不用 i18n 就把 copy() 预设去掉（去掉后 C 域会进 skipped 明列）',
  run: (ctx) => {
    const index = ctx.i18n
    if (!index || index.files.length > 0) return []
    return [
      finding(
        'C07',
        index.resourceDir,
        1,
        `声明了 i18n（resourceDir=${index.resourceDir}），但一个文案文件都没有：C 域这几条规则等于没跑`,
      ),
    ]
  },
}

export const copyRules: Rule[] = [
  // C01 裸文案委派给 eslint-plugin-i18next 的 no-literal-string（它只有这一条规则：
  // **不做**键存在性与未使用键，所以 C02 / C06 由我们自己实现 —— 见 docs/ECOSYSTEM-AUDIT.md）
  keysExist,
  languageParity,
  oneNamespacePerFile,
  shardsAggregated,
  noDeadKeys,
  i18nResourcesExist,
]
