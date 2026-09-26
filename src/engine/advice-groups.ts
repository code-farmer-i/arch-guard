import type { Advice } from './advice-types.js'
import { isTestPath } from './test-paths.js'
import type { Graph } from './graph.js'
import type { Config, Facts, FileRecord } from './types.js'

export interface GroupAdviceInput {
  config: Config
  records: FileRecord[]
  facts: Map<string, Facts>
  graph: Graph
  files: string[]
}

interface Group {
  label: string
  /** 组的基准目录（组内文件的最长公共目录）：用来找"这个组的测试" */
  base: string
  files: FileRecord[]
}

/** 组 = 结构声明里的组维度（`groupName` + `group`）+ 组内源文件（测试不计入） */
function groupIndexOf(records: FileRecord[]): Map<string, Group> {
  const groups = new Map<string, Group>()
  for (const record of records) {
    if (record.layer >= 90) continue // 测试 / story 不算"组的文件"
    if (!record.groupName || !record.group) continue
    const key = `${record.groupName}:${record.group}`
    const entry = groups.get(key) ?? {
      label: `${record.groupName} ${record.group}`,
      base: '',
      files: [],
    }
    entry.files.push(record)
    groups.set(key, entry)
  }
  for (const group of groups.values()) group.base = commonDirectory(group.files.map((f) => f.rel))
  return groups
}

/** 最长公共目录：`src/modules/crews/{views,lib}/…` → `src/modules/crews` */
function commonDirectory(paths: string[]): string {
  const split = paths.map((path) => path.split('/').slice(0, -1))
  const first = split[0] ?? []
  let length = first.length
  for (const parts of split) {
    length = Math.min(length, parts.length)
    for (let index = 0; index < length; index += 1) {
      if (parts[index] !== first[index]) {
        length = index
        break
      }
    }
  }
  return first.slice(0, length).join('/')
}

/** "该配单测的逻辑"住在哪些片段里（canonical 的槽位与 FSD 的片段都在这份词汇里） */
const LOGIC_SEGMENTS = ['lib', 'model', 'api', 'hooks', 'stores', 'store', 'selectors']

/** 组级三条信号（R-122 / R-123 / R-124） */
export function groupLevelAdvice(input: GroupAdviceInput): Advice[] {
  const groups = groupIndexOf(input.records)
  if (groups.size === 0) return []
  const groupOfRel = new Map<string, Group>()
  for (const group of groups.values()) {
    for (const record of group.files) groupOfRel.set(record.rel, group)
  }
  return [
    ...untestedLogicGroupAdvice(input, groups),
    ...peerReuseAdvice(input, groupOfRel),
    ...groupCycleAdvice(input, groups, groupOfRel),
  ]
}

/**
 * 信号三：**未测试的逻辑组**（R-122）。
 *
 * 组里有"逻辑"（非 JSX 文件里声明了非类型导出）却整组 0 个测试 —— 测试跟着人走、不跟着模块走。
 * 边界：纯 JSX 的页面 / 组件组不算（那不是"逻辑"）；测试文件不计入组。
 */
function untestedLogicGroupAdvice(input: GroupAdviceInput, groups: Map<string, Group>): Advice[] {
  const out: Advice[] = []
  for (const group of groups.values()) {
    const logic = group.files.find((record) => {
      // 只认**逻辑片段**里的文件：路由表、装配、页面都不是"该配单测的逻辑"
      if (!LOGIC_SEGMENTS.some((segment) => record.rel.includes(`/${segment}/`))) return false
      const own = input.facts.get(record.rel)
      if (!own || own.hasJsx) return false
      return own.exports.some((item) => item.declared && !item.typeOnly)
    })
    if (!logic) continue
    const hasTest = input.files.some((rel) => rel.startsWith(`${group.base}/`) && isTestPath(rel))
    if (hasTest) continue
    out.push({
      signal: 'untested-logic-group',
      subject: group.label,
      text:
        `${group.label} 有逻辑（${logic.rel}）却**整组 0 个测试**：测试是跟着人走、不是跟着模块走。\n` +
        '  常见处置：① 给它的逻辑补一组测试 ② 顺带把这份逻辑纳入 `requireTestsFor`（否则没人会想起来）\n' +
        '  （建议不阻断 —— 门禁这一轮照常通过）',
    })
  }
  return out
}

/** 组边：跨组依赖（测试 / 生成物不计），并记录"被谁用" */
function groupEdges(
  input: GroupAdviceInput,
  groupOfRel: Map<string, Group>,
): Map<Group, Set<Group>> {
  const edges = new Map<Group, Set<Group>>()
  for (const [from, targets] of input.graph.edges) {
    const source = groupOfRel.get(from)
    if (!source) continue
    for (const target of targets) {
      const to = groupOfRel.get(target)
      if (!to || to === source) continue
      const set = edges.get(source) ?? new Set<Group>()
      set.add(to)
      edges.set(source, set)
    }
  }
  return edges
}

/**
 * 信号四：**同层组复用**（R-123）。
 *
 * 一个组被 ≥3 个"同级或更高层级"的组引用 —— 它其实已经是公共依赖，只是没人承认这个地位。
 * 边界：**更高层用更低层（更共享）是设计如此**（FSD 的 `pages/widgets/features → entities`），不算；
 * 只有"平级之间"的复用才提示。声明 `isolate` 的项目本来就报（S22），不必再劝。
 */
function peerReuseAdvice(input: GroupAdviceInput, groupOfRel: Map<string, Group>): Advice[] {
  const layerOf = new Map<string, number>()
  for (const record of input.records) {
    if (record.layer >= 90) continue
    layerOf.set(record.rel, record.layer)
  }
  /** 被消费的组 → 消费它的组集合（只算"消费者不在更共享的层"的边） */
  const consumers = new Map<Group, Set<Group>>()
  for (const [from, targets] of input.graph.edges) {
    const source = groupOfRel.get(from)
    if (!source) continue
    const sourceLayer = layerOf.get(from) ?? 0
    for (const target of targets) {
      const to = groupOfRel.get(target)
      if (!to || to === source) continue
      const targetLayer = layerOf.get(target) ?? 0
      if (targetLayer < sourceLayer) continue // 上层用下层（更共享）= 正常
      const set = consumers.get(to) ?? new Set<Group>()
      set.add(source)
      consumers.set(to, set)
    }
  }
  const out: Advice[] = []
  for (const [group, who] of consumers) {
    if (who.size < 3) continue
    out.push({
      signal: 'peer-reuse',
      subject: group.label,
      text:
        `${group.label} 被 ${who.size} 个**同级或更内层**的组引用（${[...who]
          .map((item) => item.label)
          .slice(0, 4)
          .join(' · ')}）：它其实已经是公共依赖，只是没人承认这个地位。\n` +
        '  （上层用它 = 正常，所以没算）\n' +
        '  常见处置：① 把被复用的部分提升到共享层 ② 确认它就是这个地位，用 `adviceAllow` 声明豁免（写理由）\n' +
        '  （建议不阻断 —— 门禁这一轮照常通过）',
    })
  }
  return out
}

/**
 * 信号五：**组级依赖环**（R-124）。
 *
 * 组边图里的环 —— 文件级可能没环（S08 看不见），但组级成环后两边再也拆不开（FSD 里两个切片互开
 * `@x` 就是这种形态）。边界：只算跨组边 · 测试 / 生成物不计。
 */
function groupCycleAdvice(
  input: GroupAdviceInput,
  groups: Map<string, Group>,
  groupOfRel: Map<string, Group>,
): Advice[] {
  const edges = groupEdges(input, groupOfRel)
  const reported = new Set<string>()
  const out: Advice[] = []
  for (const start of groups.values()) {
    // 从每个组出发做 DFS，找到回到 start 的路径即为环（同一环只报一次）
    const stack: Group[] = []
    const visit = (node: Group, seen: Set<Group>): Group[] | null => {
      // 每次进入都从当前路径出发；回到 start 即成环

      stack.push(node)
      for (const next of edges.get(node) ?? []) {
        if (next === start && stack.length > 1) return [...stack]
        if (seen.has(next)) continue
        seen.add(next)
        const found = visit(next, seen)
        if (found) return found
      }
      stack.pop()
      return null
    }
    stack.length = 0
    const cycle = visit(start, new Set([start]))
    if (!cycle) continue
    const key = cycle
      .map((item) => item.label)
      .sort()
      .join('|')
    if (reported.has(key)) continue
    reported.add(key)
    out.push({
      signal: 'group-cycles',
      subject: key.replace(/\|/g, ' ↔ '),
      text:
        `组级依赖环：${cycle.map((item) => item.label).join(' → ')} → ${start.label}：` +
        '两边互相依赖（文件级可能没有环，所以 S08 看不见）—— 拆 / 换其中一个都要动另一个。\n' +
        '  常见处置：① 把共用部分下沉到共享层 ② 让一侧单向依赖（用公开面 + 事件 / 回调反转）\n' +
        '  （建议不阻断 —— 门禁这一轮照常通过）',
    })
  }
  return out
}
