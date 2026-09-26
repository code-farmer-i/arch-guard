import { resolveSpecifier, type Graph } from './graph.js'
import type { Diagnostic } from './codes.js'
import type { Config, Facts, FileRecord } from './types.js'

/** 保守阈值：**≥3 个导出各自只被一个域用**才算信号（2 个可能是巧合） */
const MIN_PER_DOMAIN_EXPORTS = 3

export interface AdviceInput {
  config: Config
  records: FileRecord[]
  facts: Map<string, Facts>
  graph: Graph
  files: string[]
}

/** 一个文件里"各归各域"的导出（名字 + 它唯一的消费域） */
interface PerDomainExport {
  name: string
  domain: string
}

/**
 * **架构建议**（R-118）：从已有事实算出**可核对的信号**，给出**处方选项**，并且**永不阻断**。
 *
 * 为什么放在「自述」里而不是规则里：规则是"违规 → 红"，必须机械可判定、零误报；而"这坨东西该不该
 * 跟域走"是**判断**，只能给信号 + 选项，让人来定。所以建议走 notice：进报告、进 JSON、**不影响退出码**。
 *
 * 第一条信号：**一个文件里的导出各归各域**（≥3 个导出，每个只被**一个域**消费，且域各不相同）——
 * 这正是架构审查里"shared 长成第二套 modules"的可判定形态：加/下线一个域都要改这个文件。
 *
 * 边界（宁少报不误伤）：
 * - **纯类型导出不算**（`interface` / `type`）：DTO 这类"契约镜像"常常按域命名却该集中；
 * - 被**多个域**共用的导出不算（那是真的跨域中立）；
 * - 只看**具名导入**；`export *` 中转、默认导入、动态导入不参与；
 * - 已经声明为公开面入口（`entry: true`）的文件不判 —— 那个的用途就是给外面引。
 */
/** 组粒度的保守阈值：1 个文件太细、20 个文件太粗（先写死，后续可声明化） */
const MIN_GROUP_FILES = 2
const MAX_GROUP_FILES = 20

/**
 * 第二条信号：**组粒度**（R-120）。
 *
 * 两种"门禁全绿但结构在变坏"的形态：
 * - **组只有 1 个源文件**：多半是 stub 或误分类 —— "域"这个词失去意义
 *   （50 个组里 30 个各一个文件，边界图看着整齐，其实没切）；
 * - **组 ≥20 个源文件**：多半是两个业务挤在一起 —— 改起来仍是全组搜。
 *
 * 组取的是**仓库自己的概念**（`record.groupName` + `record.group`，即结构声明里的组维度），
 * 所以范式无关：canonical 的 `{domain}` 与 FSD 的 `{slice}` 都吃。测试文件（layer ≥ 90）不计。
 */
function pushGroupGranularityAdvice(notices: Diagnostic[], records: FileRecord[]): void {
  const groups = new Map<string, { label: string; files: string[] }>()
  for (const record of records) {
    if (record.layer >= 90) continue
    if (!record.groupName || !record.group) continue
    const key = `${record.groupName}:${record.group}`
    const entry = groups.get(key) ?? { label: `${record.groupName} ${record.group}`, files: [] }
    entry.files.push(record.rel)
    groups.set(key, entry)
  }
  for (const { label, files } of groups.values()) {
    if (files.length < MIN_GROUP_FILES) {
      notices.push({
        code: 'architecture-advice',
        text:
          `${label} 只有 1 个源文件（${files[0]}）：这一层"组"其实是一个文件。\n` +
          `  常见处置：① 并进相邻组 ② 如果它确实横切、被多个组用，提升为共享层` +
          ` ③ 确认它只是 stub，那就先别单独成组\n` +
          `  （建议不阻断 —— 门禁这一轮照常通过）`,
      })
      continue
    }
    if (files.length > MAX_GROUP_FILES) {
      notices.push({
        code: 'architecture-advice',
        text:
          `${label} 有 ${files.length} 个源文件：这个组可能装了两个业务（改一处仍要全组搜）。\n` +
          `  常见处置：① 按子域拆成两个组 ② 若它确实是一个域，把这条阈值显式调高（声明出来）\n` +
          `  （建议不阻断 —— 门禁这一轮照常通过）`,
      })
    }
  }
}

export function pushAdviceNotices(input: AdviceInput, notices: Diagnostic[]): void {
  const { config, records, facts, graph, files } = input
  if (records.length === 0) return
  pushGroupGranularityAdvice(notices, records)
  const fileSet = new Set(files)
  const byRel = new Map(records.map((record) => [record.rel, record]))
  const domainOf = (rel: string): string => {
    const record = byRel.get(rel)
    return record?.domain ?? record?.captures?.domain ?? record?.captures?.slice ?? ''
  }
  const entryRoleIds = new Set(
    config.roles.filter((role) => role.entry === true).map((role) => role.id),
  )

  for (const record of records) {
    const own = facts.get(record.rel)
    if (!own || own.exports.length === 0) continue
    if (entryRoleIds.has(record.role)) continue // 公开面入口就是给外面引的
    /** 导出名 → 消费它的域集合（只数具名导入） */
    const consumers = new Map<string, Set<string>>()
    for (const importer of graph.importers.get(record.rel) ?? []) {
      const domain = domainOf(importer)
      if (domain === '') continue
      const importerFacts = facts.get(importer)
      if (!importerFacts) continue
      for (const item of importerFacts.imports) {
        if (!item.names || item.names.length === 0) continue
        if (resolveSpecifier(item.spec, importer, config, fileSet) !== record.rel) continue
        for (const name of item.names) {
          const set = consumers.get(name) ?? new Set<string>()
          set.add(domain)
          consumers.set(name, set)
        }
      }
    }
    if (consumers.size === 0) continue
    const perDomain: PerDomainExport[] = []
    for (const item of own.exports) {
      if (!item.declared) continue
      if (item.typeOnly) continue // 契约镜像（DTO）按域命名但该集中
      const set = consumers.get(item.name)
      if (!set || set.size !== 1) continue
      perDomain.push({ name: item.name, domain: [...set][0] as string })
    }
    const domains = new Set(perDomain.map((item) => item.domain))
    if (perDomain.length < MIN_PER_DOMAIN_EXPORTS || domains.size < 2) continue
    const listing = perDomain
      .slice(0, 4)
      .map((item) => `${item.name}→${item.domain}`)
      .join(' · ')
    notices.push({
      code: 'architecture-advice',
      text:
        `${record.rel} 里有 ${perDomain.length} 个导出**各归各域**（${listing}${perDomain.length > 4 ? ' …' : ''}）：` +
        `加 / 下线一个域都要改这个文件。\n` +
        `  常见处置：① 下沉到各自的域（跟着域走，判据见 PARADIGM §6.15）` +
        ` ② 若它确实是跨域中立的，把归属声明出来即可消掉这条建议\n` +
        `  （建议不阻断 —— 门禁这一轮照常通过）`,
    })
  }
}
