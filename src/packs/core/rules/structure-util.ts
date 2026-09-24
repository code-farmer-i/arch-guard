import type { FileRecord, Finding } from '../../../engine/types.js'

/**
 * 声明驱动结构规则的**共用零件**：报错构造、角色目录推导、分桶。
 *
 * 抽出来的唯一理由是"分桶口径只有一处真相" —— S26 / S29 / S30 / S31 都按「层 + 父桶」看组，
 * 各写一遍迟早会走偏（比如一个按 captures 排序、另一个不排）。
 */

export const finding = (
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
 * 单元目录：优先从角色 pattern 的 `dir/**` 形态取；pattern 不是这个形态时，
 * 退回"命中该角色的文件的公共目录"。两者都拿不到就跳过（宁少报不误报）。
 */
export function unitDirOf(
  roles: { id: string; pattern: string }[],
  roleId: string,
  records: { rel: string }[],
): string | null {
  const pattern = roles.find((role) => role.id === roleId)?.pattern
  const suffix = '/**'
  if (pattern?.endsWith(suffix)) return pattern.slice(0, -suffix.length)
  const dirs = records.map((record) => {
    const index = record.rel.lastIndexOf('/')
    return index === -1 ? '' : record.rel.slice(0, index)
  })
  const first = dirs[0]
  if (first === undefined) return null
  let common = first
  for (const dir of dirs) {
    while (common !== '' && !dir.startsWith(common)) {
      const index = common.lastIndexOf('/')
      common = index === -1 ? '' : common.slice(0, index)
    }
  }
  return common === '' ? null : common
}

/**
 * 角色 pattern 的**目录部分**（去掉 `/**`，或去掉文件名那一段），按路径段返回。
 * 例如 `src/pages/{slice}/ui/**` → `['src','pages','{slice}','ui']`；`src/a/index.ts` → `['src','a']`。
 */
export function dirPatternSegments(pattern: string): string[] | null {
  const suffix = '/**'
  const dir = pattern.endsWith(suffix)
    ? pattern.slice(0, -suffix.length)
    : pattern.slice(0, pattern.lastIndexOf('/'))
  const segments = dir.split('/')
  return segments.length >= 2 && segments[0] !== '' ? segments : null
}

/** 一个路径段能否被 pattern 里的段匹配（`{name}` 匹配任意一段；`{a,b}` 按枚举匹配） */
export function segmentMatches(patternSegment: string, actual: string): boolean {
  if (!patternSegment.includes('{')) return patternSegment === '*' || patternSegment === actual
  const inner = patternSegment.slice(
    patternSegment.indexOf('{') + 1,
    patternSegment.lastIndexOf('}'),
  )
  const options = inner.split(',').map((item) => item.trim())
  if (options.length === 1) return true
  const suffix = patternSegment.slice(patternSegment.lastIndexOf('}') + 1)
  return options.some((option) => `${option}${suffix}` === actual)
}

/**
 * 文件路径里**超出角色 pattern 目录部分**的那些目录（相对根的全路径）。
 * pattern 与路径对不上（角色表被改过、pattern 形态奇特）时返回 `null` —— 宁少报不误报。
 */
export function extraDirsOf(rel: string, pattern: string): string[] | null {
  const expected = dirPatternSegments(pattern)
  if (expected === null) return null
  const dirs = rel.split('/').slice(0, -1)
  if (dirs.length < expected.length) return null
  for (const [index, segment] of expected.entries()) {
    const actual = dirs[index]
    if (actual === undefined || !segmentMatches(segment, actual)) return null
  }
  const out: string[] = []
  for (let index = expected.length; index < dirs.length; index += 1) {
    out.push(dirs.slice(0, index + 1).join('/'))
  }
  return out
}

export function bucketsOf(
  ctx: { records: FileRecord[] },
  dimension: string,
  layers: Set<number> | null = null,
): Map<
  string,
  { layer: number; bucket: string; anchor: string; names: Set<string>; ancestors: string[] }
> {
  const buckets = new Map<
    string,
    { layer: number; bucket: string; anchor: string; names: Set<string>; ancestors: string[] }
  >()
  for (const record of ctx.records) {
    if (record.layer >= 90) continue
    if (record.groupName !== dimension || !record.group) continue
    if (layers !== null && !layers.has(record.layer)) continue
    const captures = record.captures ?? {}
    const others = Object.keys(captures)
      .filter((name) => name !== dimension)
      .sort()
      .map((name) => `${name}=${captures[name]}`)
    const key = `${record.layer}|${others.join('&')}`
    const seen = buckets.get(key) ?? {
      layer: record.layer,
      bucket: others.join('&'),
      anchor: record.rel,
      names: new Set<string>(),
      // 祖先捕获值（如分组切片的 `{group}`）：完整切片路径 = 祖先段 + 叶子名，S29 要逐段比对
      ancestors: Object.keys(captures)
        .filter((name) => name !== dimension)
        .sort()
        .map((name) => captures[name] ?? '')
        .filter((value) => value !== ''),
    }
    if (record.rel < seen.anchor) seen.anchor = record.rel
    seen.names.add(record.group.slice(record.group.lastIndexOf('/') + 1))
    buckets.set(key, seen)
  }
  return buckets
}

/** 角色 pattern 的 `dir/**` 形态 → 目录；不是这个形态时返回 null */
export function dirOfPattern(pattern: string): string | null {
  return pattern.endsWith('/**') ? pattern.slice(0, -3) : null
}
