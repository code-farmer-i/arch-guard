import type { Finding, Rule } from '../../../engine/types.js'

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

export const copyRules: Rule[] = [
  // 裸文案 / 键存在 / 死键委派给 eslint-plugin-i18next（或 no-restricted-syntax 选择器）
  languageParity,
  oneNamespacePerFile,
  shardsAggregated,
]
