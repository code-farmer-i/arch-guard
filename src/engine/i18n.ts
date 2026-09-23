import ts from 'typescript'

/**
 * i18n 资源索引：把 `<resourceDir>/<lang>/<namespace>.ts` 解析成「键路径 → 行号」。
 *
 * 用 TS 解析器而不是正则：文案对象的嵌套、引号风格、注释都可能变，
 * 正则切对象迟早出错。键路径按 `.` 拼接（`nav.crews.title`），与 `t()` 的写法一致。
 */
export interface LocaleKeyFact {
  path: string
  line: number
}

export interface LocaleFileFacts {
  rel: string
  /** 目录第一段（zh-CN / en / …） */
  language: string
  /** 文件名去掉扩展名；`index` 表示该语言的聚合入口 */
  namespace: string
  isEntry: boolean
  keys: LocaleKeyFact[]
}

export interface I18nIndex {
  resourceDir: string
  languages: string[]
  files: LocaleFileFacts[]
}

const lineOf = (sf: ts.SourceFile, pos: number): number =>
  sf.getLineAndCharacterOfPosition(pos).line + 1

const keyTextOf = (name: ts.PropertyName, sf: ts.SourceFile): string => {
  if (ts.isIdentifier(name) || ts.isStringLiteralLike(name) || ts.isNumericLiteral(name))
    return name.text
  // 计算属性名（`[key]`）：取表达式文本并去掉方括号，读起来仍是能用作键名的形式
  return name
    .getText(sf)
    .replace(/^\[|\]$/g, '')
    .replace(/['"]/g, '')
}

function collectKeys(
  object: ts.ObjectLiteralExpression,
  prefix: string,
  sf: ts.SourceFile,
  out: LocaleKeyFact[],
): void {
  for (const property of object.properties) {
    if (!ts.isPropertyAssignment(property)) continue
    const key = keyTextOf(property.name, sf)
    const path = prefix ? `${prefix}.${key}` : key
    const value = property.initializer
    if (ts.isObjectLiteralExpression(value)) {
      collectKeys(value, path, sf, out)
      continue
    }
    out.push({ path, line: lineOf(sf, property.name.getStart(sf)) })
  }
}

export function parseLocaleFile(
  rel: string,
  text: string,
  resourceDir: string,
): LocaleFileFacts | null {
  const rest = rel.slice(resourceDir.length + 1)
  const segments = rest.split('/')
  if (segments.length !== 2) return null
  const language = segments[0] as string
  const file = segments[1] as string
  const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true)
  let object: ts.ObjectLiteralExpression | null = null
  sf.forEachChild((node) => {
    if (ts.isExportAssignment(node) && ts.isObjectLiteralExpression(node.expression))
      object = node.expression
  })
  if (!object) return null
  const namespace = file.replace(/\.(ts|tsx)$/, '')
  const isEntry = namespace === 'index'
  // 文件名就是命名空间：`nav.ts` 里的 `crews` 对外是 `nav.crews`。
  // 聚合入口（index.ts）只是把分片拼起来，它自己的键没有意义。
  const keys: LocaleKeyFact[] = []
  if (!isEntry) collectKeys(object, namespace, sf, keys)
  return { rel, language, namespace, isEntry, keys }
}

export function collectI18n(input: {
  records: { rel: string; kind: string }[]
  sourceOf: (rel: string) => string | undefined
  resourceDir: string
}): I18nIndex {
  const files: LocaleFileFacts[] = []
  for (const record of input.records) {
    if (record.kind !== 'ts') continue
    if (!record.rel.startsWith(`${input.resourceDir}/`)) continue
    const text = input.sourceOf(record.rel)
    if (text === undefined) continue
    const parsed = parseLocaleFile(record.rel, text, input.resourceDir)
    if (parsed) files.push(parsed)
  }
  return {
    resourceDir: input.resourceDir,
    languages: [...new Set(files.map((file) => file.language))].sort(),
    files,
  }
}
