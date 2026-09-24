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
  /**
   * 角色 pattern 里**所有** `{name}` 捕获。`domain` 只是 `captures.domain` 的快捷方式，
   * 结构声明化之后规则靠这里拿"这段路径到底在哪一组"（如 `{slice}`）。
   */
  captures: Record<string, string>
  /** 组值：角色声明了 `group: '<捕获名>'` 时取该捕获的值（如 `crews`），否则 null */
  group: string | null
  /** 组维度名（捕获名），如 `slice`；无组为 null */
  groupName: string | null
  kind: FileKind
  /** 页面级单元（来自角色的 `pageLike`）：S16 用 `viewLines` 判它 */
  pageLike?: boolean
}

export interface RoleDescriptor {
  id: string
  pattern: string
  layer: number
  slot?: string
  /** 排他角色：命中即独占（测试文件之类不该再和槽位争角色） */
  exclusive?: boolean
  /**
   * 组维度：本角色的文件属于"某个组"，组名取该捕获的值。
   * 例：`pattern: 'src/pages/{slice}/ui/**', group: 'slice'` → 同一切片的文件同组。
   * 组是 S22（组隔离）与 S23（公开面）的判定单位。
   */
  group?: string
  /** 本角色是所属组的**公开面（入口）**，配合 `structure.publicApi` 使用 */
  entry?: boolean
  /**
   * 本角色是「**页面级**」单元 —— S16 对它用 `viewLines` 而不是 `fileLines`。
   *
   * 为什么要有这个字段：S16 原来只看 `slot === 'views'`，于是没有槽位语义的范式
   * （library / FSD 的 `pages/<切片>/ui`）下 `viewLines` **静默失效** —— 配了也不生效。
   * 页面级由**角色表**声明，规则不再猜。
   */
  pageLike?: boolean
}

/* ---------------- 配置与适配器 ---------------- */

/**
 * 结构声明：把"目录规范"变成宿主可声明的数据，规则从声明推导。
 *
 * 三个字段**各被一条规则消费**（S21 / S22 / S23）—— 不做"声明了没人读"的配置。
 * 参照系：ArchUnit / import-linter / go-arch-lint / Nx tags 都是这个形状。
 */
export interface StructureSpec {
  /** 层序单向：只许依赖**层号 ≤ 自己**的文件（S21）。应用范式与库/FSD 都声明它 —— 一套机制 */
  order?: boolean
  /** 组隔离：组维度名列表（捕获名）。同维度、同层、不同组之间**不许互相引用**（S22） */
  isolate?: string[]
  /** 公开面：组维度名列表。这些维度的组**必须有入口文件**，且组外不许直接引用组内非入口文件（S23） */
  publicApi?: string[]
}

/** 归一化后的结构声明：宿主只声明一部分，配置加载后三个字段都补齐 */
export interface ResolvedStructure {
  order: boolean
  isolate: string[]
  publicApi: string[]
}

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

/**
 * **规则级例外**：声明「**这条规则**对**这类文件**不适用」—— 不是「这个文件免检」。
 *
 * 为什么必须是规则级：文件级豁免（曾经那个 `exempt`）让整个文件不进角色表、不解析事实、
 * 所有规则一起停看 —— 为了表达"console 对输出口是合法的"，代价是这个文件从此不受任何架构约束。
 * 现在的实现是**对发现项做后置过滤**：文件照常有角色、进依赖图、被其它规则判定，只有指名的那条规则被摘掉。
 *
 * 三种需求的分工（别再混用）：
 *   ① 这片树不属于契约 → `include` / `ignore`（覆盖面问题，不是违规问题）
 *   ② 这条规则对它不适用 → 这里（唯一需要例外的情形：修了功能就没了 / 夹具就没意义了）
 *   ③ 暂时不想修（存量债）→ **没有这个通道**（基线机制已移除，不合规就是红）
 */
export interface ExceptionEntry {
  /** 规则 id，必须真实存在（`runGuard` 会校验，拼错直接报错） */
  rule: string
  /** 文件 glob（配置根相对） */
  glob: string
  /** 为什么这条规则对它不适用（必填，进 diff 可评审） */
  reason: string
  /** 到期日 `YYYY-MM-DD`：写了就必过期 —— 过期后门禁直接报错，逼你续期或删掉 */
  expires?: string
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
  examples?: AdapterExamples
}

/**
 * i18n 适配器（文案域的能力来源）。
 * 库名（`from`）只许出现在 `presets/i18n-kits/*` —— 通用预设 `copy()` 里不许有。
 */
export interface I18nAdapter {
  facet: 'i18n'
  id: string
  specVersion?: string
  from?: string[]
  /** 翻译函数名（默认 `t`） */
  fn?: string
  /** 翻译 hook 名（默认 `useTranslation`） */
  hook?: string
  /** 资源目录：`<resourceDir>/<lang>/<namespace>.ts`；缺省由范式的 `params.i18nDir` 补 */
  resourceDir?: string
  /** 项目声明要支持的语言（与磁盘实况对账，C07） */
  languages?: string[]
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

export type Adapter = UiKitAdapter | I18nAdapter | GenericAdapter

export interface Preset {
  /**
   * 范式标识（`canonical` / `library` / `fsd`）。
   *
   * 一个配置**只能有一个范式预设** —— 角色表是整体替换的，两个范式混用会得到
   * "角色表来自后者、layout 逐键混合、structure 取并集"的静默错误组合，所以 `loadConfig` 见到
   * 两个不同范式就直接报错（fail-closed）。
   */
  paradigm?: string
  roles?: RoleDescriptor[]
  /**
   * 在范式角色表**之上追加**角色（不替换）。
   *
   * 用途：项目在所选规范之外还有自己的目录（如 `src/legacy/**`）——
   * 不追加的话只能整份重写 `roles`，那样范式一升级就漂了。
   */
  addRoles?: RoleDescriptor[]
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
  /** 结构声明（层序 / 组隔离 / 公开面）：多个预设之间**加法合并** */
  structure?: StructureSpec
  params?: Record<string, unknown>
  entries?: string[]
  ignore?: string[]
  /** 契约扫描域：只有命中这些 glob 的 ts/css 参与角色判定（空 = 不限制） */
  include?: string[]
  /** 元框架标识（`react` / `vue` / …）：决定哪些源码扩展名归本 pack 管 */
  metaFramework?: string
  exceptions?: ExceptionEntry[]
}

/**
 * 宿主 `overrides` 的形状：Config 的逐键覆盖，**外加一个 Config 上不存在的字段** `addRoles`。
 *
 * 为什么单独建模：`addRoles` 是"在范式角色表之上追加"的**输入**，不是解析结果的一部分 ——
 * 解析后追加结果已经并进 `Config.roles`。曾经 Config 上也留了一份 `addRoles`，赋值后无人读，
 * 是同一事实的第二处存放（读它就会把角色重复计入）；现在只留在输入侧。
 */
export type ConfigOverrides = Partial<Config> & {
  /** 在范式角色表之上**追加**角色（不是替换；要整体替换用 `roles`） */
  addRoles?: RoleDescriptor[]
}

export interface Config {
  root: string
  srcRoot: string
  /**
   * 范式标识（`canonical` / `library` / `fsd`；自写预设可不写）。
   *
   * 以前只有 `loadConfig` 的"一个配置只许一个范式"校验在读它，**没进合并后的配置** ——
   * 于是 `placementHint` 只能靠 `layout` 猜范式，FSD 被猜成库范式、给出
   * 「先在 `library({ modules })` 里补上」这种不相干的建议。现在它是**可消费的事实**。
   */
  paradigm?: string
  layout: { app: string; modules: string; shared: string }
  roles: RoleDescriptor[]
  naming: NamingRules
  thresholds: Thresholds
  adapters: Record<string, Adapter>
  enable: string[] | 'all'
  /** 显式排除的规则：`enable` 求完之后再减掉 */
  disable: string[]
  /** 结构声明：层序 / 组隔离 / 公开面（S21–S23 的判据来源）。**已归一化**，三个字段都在 */
  structure: ResolvedStructure
  params: Record<string, unknown>
  entries: string[]
  ignore: string[]
  /** 契约扫描域（配置根相对 glob）；空 = 全树都参与契约判定 */
  include: string[]
  /** 元框架标识：当前 pack 负责哪些源码扩展名（见 src/data/framework-sources.ts） */
  metaFramework: string
  exceptions: ExceptionEntry[]
  aliases: Record<string, string>
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
