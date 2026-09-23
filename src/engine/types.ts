/**
 * 规则面向的契约：事实模型、配置、规则与发现项。
 * 规则只依赖这里定义的结构，不依赖任何 parser 或框架（见 docs/DESIGN.md §6.1.1）。
 */

export type FileKind = 'ts' | 'css' | 'json' | 'other'

/* ---------------- 事实模型 ---------------- */

export interface ImportFact {
  spec: string
  line: number
  typeOnly: boolean
  dynamic: boolean
}

export interface ExportFact {
  name: string
  kind: string
  isStar: boolean
  isDefault: boolean
  typeOnly: boolean
  line: number
  declared?: boolean
}

export interface StringFact {
  value: string
  line: number
  context: string
  prop: string | null
}

export interface CallFact {
  callee: string
  line: number
  /** 第一个字符串字面量参数（t('nav.crews') 里的 nav.crews）；没有则缺省 */
  stringArg?: string
  /** 第一个参数是模板串时的静态前缀（t(`nav.${x}`) 里的 "nav."），动态键靠它判定「被用过」 */
  keyPrefix?: string
}

export interface FunctionFact {
  name: string
  line: number
  lines: number
  isComponent: boolean
}

export interface CommentFact {
  line: number
  text: string
  kind: string
  /** 区间 [pos, end)：指纹扫描时要遮罩掉注释，避免「注释里写了轮子」被误报 */
  pos: number
  end: number
}

export interface ParseErrorFact {
  line: number
  message: string
}

/**
 * 单个文件的事实模型。字段是**规则实际会读的**那些 —— 加字段前先确认有规则在读
 * （见 `facts.ts` 里 `extractFacts` 的说明与 docs/ECOSYSTEM-AUDIT.md）。
 */
export interface Facts {
  file: string
  rel: string
  role: string
  lineCount: number
  parseErrors: ParseErrorFact[]
  imports: ImportFact[]
  exports: ExportFact[]
  strings: StringFact[]
  calls: CallFact[]
  functions: FunctionFact[]
  comments: CommentFact[]
  hasJsx: boolean
}

/* ---------------- 结构与角色 ---------------- */

export interface FileRecord {
  rel: string
  abs: string
  role: string
  layer: number
  domain: string | null
  slot: string | null
  kind: FileKind
}

export interface RoleDescriptor {
  id: string
  pattern: string
  layer: number
  slot?: string
  /** 排他角色：命中即独占（测试文件之类不该再和槽位争角色） */
  exclusive?: boolean
}

/* ---------------- 配置与适配器 ---------------- */

export interface Thresholds {
  fileLines: number
  viewLines: number
  functionLines: number
  exportsPerFile: number
  componentsPerFile: number
}

export interface NamingRules {
  hookPrefix: string
  viewSuffix: string
}

export interface ExemptEntry {
  glob: string
  reason?: string
}

export interface AdapterExamples {
  vendorSelectors?: { hit: string[]; miss: string[] }
  [key: string]: unknown
}

export interface DetachedApi {
  from: string[]
  members: string[]
  kind?: string
  suggest?: string
}

export interface UiKitAdapter {
  facet: 'ui-kit'
  id: string
  specVersion?: string
  packages: string[]
  icons?: { from: string[] }
  vendorSelectors?: string[]
  vendorVars?: string[]
  detachedApis?: DetachedApi[]
  styleProps?: string[]
  themeIntegration?: { css?: string; js?: string[] }
  policy?: Record<string, unknown>
  examples?: AdapterExamples
}

export interface GenericAdapter {
  facet: string
  id: string
  specVersion?: string
  packages?: string[]
  examples?: AdapterExamples
  [key: string]: unknown
}

export type Adapter = UiKitAdapter | GenericAdapter

export interface Preset {
  roles?: RoleDescriptor[]
  layout?: { app: string; modules: string; shared: string }
  srcRoot?: string
  naming?: Partial<NamingRules>
  thresholds?: Partial<Thresholds>
  adapters?: Record<string, Adapter>
  /**
   * 本预设**贡献**的规则。多个预设是**并集**（相加），不是后者覆盖前者 ——
   * 否则 `library() + designSystem()` 这种组合会把后者贡献的域静默关掉。
   * `'all'` 表示"全部注册的规则"，与任何列表并集仍是 `'all'`。
   */
  enable?: string[] | 'all'
  /** 本预设**排除**的规则（并从所有预设的 disable 取并集） */
  disable?: string[]
  params?: Record<string, unknown>
  entries?: string[]
  ignore?: string[]
  /** 契约扫描域：只有命中这些 glob 的 ts/css 参与角色判定（空 = 不限制） */
  include?: string[]
  /** 元框架标识（`react` / `vue` / …）：决定哪些源码扩展名归本 pack 管 */
  metaFramework?: string
  exempt?: ExemptEntry[]
}

export interface Config {
  root: string
  srcRoot: string
  layout: { app: string; modules: string; shared: string }
  roles: RoleDescriptor[]
  naming: NamingRules
  thresholds: Thresholds
  adapters: Record<string, Adapter>
  enable: string[] | 'all'
  /** 显式排除的规则：`enable` 求完之后再减掉 */
  disable: string[]
  params: Record<string, unknown>
  entries: string[]
  ignore: string[]
  /** 契约扫描域（配置根相对 glob）；空 = 全树都参与契约判定 */
  include: string[]
  /** 元框架标识：当前 pack 负责哪些源码扩展名（见 src/data/framework-sources.ts） */
  metaFramework: string
  exempt: ExemptEntry[]
  aliases: Record<string, string>
  baselineFile: string
  autoFix?: boolean
}

/* ---------------- 规则与发现项 ---------------- */

export type Level = 'L1' | 'L2' | 'L3' | 'L4'
export type Severity = 'error' | 'warn'
export type Domain = 'structure' | 'design' | 'copy' | 'deps' | 'hygiene' | 'metrics'

export interface Finding {
  rule: string
  file: string
  line: number
  text: string
  hint?: string
  /** 棘轮锚点：单行取规范化行文本哈希；文件级/符号级由规则给出稳定签名 */
  anchor?: string
  anchorKind?: 'line' | 'file' | 'symbol'
  /** 全局谓词（不可归属到变更文件）标记，scope 过滤时不能被静默丢弃 */
  global?: boolean
}

export interface RuleContext {
  config: Config
  records: FileRecord[]
  facts: Map<string, Facts>
  graph: import('./graph.js').Graph
  scan: import('./scan.js').ScanResult
  /** 依赖事实：声明了什么、真实用了什么 */
  deps: import('./deps.js').ProjectDeps
  /** 依赖策略：allow / deny / capabilities */
  policy: import('./deps.js').DepsPolicy
  /** i18n 资源索引（文案域规则用；未配置资源目录时为空） */
  i18n?: import('./i18n.js').I18nIndex
  /** 度量产物（M 域规则用）：报告本体或读取失败的原因 */
  metrics?: {
    reportPath: string
    report: import('./coverage.js').CoverageReport | null
    error?: string
  }
  /** git 事实（M05 变更必须被覆盖用；无 git 时为 undefined） */
  git?: { changedFiles: string[] | null; headTimeMs: number | null }
  files: string[]
  /** 按 rel 读原始文本（规则需要行文本算锚点时用） */
  sourceOf: (rel: string) => string | undefined
}

export interface Rule {
  id: string
  domain: Domain
  level: Level
  severity: Severity
  title: string
  /** 能力依赖：未声明的能力对应规则不注册（见 docs/DESIGN.md §7.4） */
  requires?: string[]
  hint?: string
  run: (ctx: RuleContext) => Finding[]
}
