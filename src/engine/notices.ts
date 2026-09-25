import type { Diagnostic } from './codes.js'
import type { ScanResult } from './scan.js'
import { globToRegExp } from './util.js'
import type { Config, Facts } from './types.js'

/**
 * **自述**（`notices`）：把"声明了什么、跳过了什么、什么不会生效、谁在生效"讲清楚。
 *
 * 抽成独立模块有两个原因：`runGuard` 有函数长度上限（与 `git.ts` / `filters.ts` / `collect.ts`
 * 同一处理方式），而它们本身也内聚 —— 都要求"说的每一句都能被机读判到"，且都带稳定 `code`。
 */

/** 扫描域 / 边界 / 阈值这三类自述 */
export function pushScanNotices(config: Config, scan: ScanResult, notices: Diagnostic[]): void {
  if (config.include.length > 0) {
    notices.push({
      code: 'scan-scope-outside',
      text: `契约扫描域 ${config.include.join(' , ')}：域外 ${scan.outside.length} 个 ts/css 不参与目录契约判定（仍在依赖图里）`,
    })
  } else if (scan.records.length === 0) {
    // include 不限（引擎默认）且全树 0 个源码：没有任何东西被判定，必须说出来。
    // include 非空的情况由 S24 报错（那是配置写错，不是空仓库）。
    notices.push({
      code: 'scan-empty',
      text: 'include 未限制，但全项目 0 个 ts/css 文件：本次没有任何东西被判定',
    })
  }

  // 阈值 `viewLines` 只对**页面级**角色生效（`pageLike` / `views` 槽位）：本范式没有这类角色时
  // 它**永远不会生效** —— 配了却没效果正是本仓最忌讳的静默失效，所以当场自述（D21 同款套路）
  if (
    config.thresholds.viewLines !== config.thresholds.fileLines &&
    !config.roles.some((role) => role.pageLike === true || role.slot === 'views')
  ) {
    notices.push({
      code: 'viewlines-no-page-role',
      text: `阈值 viewLines=${config.thresholds.viewLines} 已设，但本范式没有页面级角色（pageLike / views 槽位）：这条阈值不会生效`,
    })
  }

  // `ignore`（项目边界）跳过了什么必须自述：它是"别碰"，被跳过的东西**不进文件集、不解析、不进图**，
  // 而报告此前完全不提它 —— 宿主把某个源码目录误写进 ignore 时，表现就是"悄无声息地不判了"
  if (scan.vcsIgnored.length > 0) {
    notices.push({
      code: 'vcs-ignored-skipped',
      text: `因 .gitignore（git 判定）跳过 ${scan.vcsIgnored.length} 个文件：契约域外、不进文件集也不解析`,
    })
  }
  if (scan.ignored.length > 0) {
    notices.push({
      code: 'ignore-skipped',
      text: `ignore（项目边界）命中 ${scan.ignored.length} 个文件，未进文件集也不解析：${config.ignore.join(' , ')}`,
    })
  }
}

/**
 * **生效的适配器**必须自述：适配器只写在配置里，报告此前完全不提它 ——
 * 于是"到底跑的是哪套 kit"只能去翻 `arch.config.mjs`（换库换错、组合 `stack()` 时手滑多写一份，
 * 现场都看不出来）。重复声明同一个面已经由 `mergePresets` 直接报错，这里报"谁在生效"。
 * 字段级全貌（形态 / 包对账）在 `--verify-deps` 的全表里。
 */
export function pushAdapterNotice(config: Config, notices: Diagnostic[]): void {
  const adapters = Object.values(config.adapters)
  if (adapters.length === 0) return
  const list = [...adapters]
    .sort((a, b) => a.facet.localeCompare(b.facet))
    .map((adapter) => `${adapter.facet}=${adapter.id}`)
    .join(' · ')
  notices.push({ code: 'adapters-in-use', text: `生效的适配器：${list}` })
}

/**
 * **M1 / R-86：声明配了却 0 命中 —— 那条纪律什么都没看**。
 *
 * 与 §4.9 的"委派跑没跑"同类问题，只是发生在**声明**这一侧：声明合法、规则也在跑，
 * 但项目里没有任何文件 / 组 / 调用能命中它 —— 报告显示"通过"，而那条纪律其实是空的。
 * （配置期的"可命中性"由 `structure.ts` 的 validate 管；这里管**运行期**：角色表里有这个维度，
 * 但没有任何文件命中那些角色。）
 *
 * 覆盖两侧：`structure.*`（R-77 = M1）与**方案面的声明**（R-86：`callSites` / `envReads` /
 * `analytics` / `router.pathSource` / `dataLayer.queryKeyFrom` / `designSystem.numberHomes`）——
 * 后者原来没人管：名字多打一个字母，报告还写着"生效的适配器：analytics=declared"。
 */
export function pushDeclarationNotices(
  config: Config,
  records: { rel: string; captures?: Record<string, string> }[],
  files: string[],
  notices: Diagnostic[],
  facts: Map<string, Facts> = new Map(),
): void {
  const empty: string[] = []
  const hasFile = (glob: string): boolean => {
    const pattern = globToRegExp(glob)
    return files.some((rel) => pattern.test(rel))
  }
  const hasDimension = (dimension: string): boolean =>
    records.some((record) => Boolean(record.captures?.[dimension]))

  for (const glob of config.structure.generated ?? []) {
    if (!hasFile(glob)) empty.push(`generated 的 ${glob}`)
  }
  for (const glob of config.structure.migrating ?? []) {
    if (!hasFile(glob)) empty.push(`migrating 的 ${glob}`)
  }
  for (const spec of config.structure.clientState ?? []) {
    for (const glob of spec.in ?? []) if (!hasFile(glob)) empty.push(`clientState.in 的 ${glob}`)
  }
  if (config.structure.authRedirects) {
    for (const glob of config.structure.authRedirects.in ?? []) {
      if (!hasFile(glob)) empty.push(`authRedirects.in 的 ${glob}`)
    }
  }
  const dimensions = [
    ...(config.structure.isolate ?? []),
    ...(config.structure.publicApi ?? []),
    ...(config.structure.segmentedGroups ?? []),
    ...(config.structure.repetitiveNaming ?? []),
    ...(config.structure.importLocality ?? []),
    ...(config.structure.groupCountLimits ?? []).map((item) => item.dimension),
    ...(config.structure.groupInDegree ?? []).map((item) => item.dimension),
    ...(config.structure.nameCollisions ?? []).map((item) => item.dimension),
    ...(config.structure.pluralConsistency ?? []).map((item) => item.dimension),
    ...(config.structure.couplingLimits ?? []).map((item) => item.dimension),
  ]
  for (const dimension of new Set(dimensions)) {
    if (!hasDimension(dimension)) empty.push(`维度 ${dimension}`)
  }

  empty.push(...emptyFaceDeclarations(config, facts, hasFile))

  if (empty.length === 0) return
  notices.push({
    code: 'declaration-no-match',
    text: `有 ${empty.length} 条声明 0 命中（那条纪律这次什么都没看，建议删掉或修对）：${empty
      .slice(0, 5)
      .join(' · ')}${empty.length > 5 ? ` …（还有 ${empty.length - 5} 条）` : ''}`,
  })
}

/** **方案面的声明**（R-86）：落点看文件是否存在、清单看在最宽松的匹配下有没有任何命中 */
function emptyFaceDeclarations(
  config: Config,
  facts: Map<string, Facts>,
  hasFile: (glob: string) => boolean,
): string[] {
  const empty: string[] = []
  const callees = [...facts.values()].flatMap((item) => item.calls.map((call) => call.callee))
  const reads = [...facts.values()].flatMap((item) => item.reads.map((read) => read.name))
  /**
   * **最宽松的匹配**（整名 / 对象前缀 / 方法后缀）：它都命中不了，那条声明必定是空的。
   * 刻意不去复用规则里那两套匹配（S38 认前缀、D24 不认）：这里宁少报不误报，而且要跨层复用就得
   * 把匹配语义搬到引擎侧，那是给一个提示功能加的真实耦合。
   */
  const called = (api: string, pool: string[]): boolean =>
    pool.some((name) => name === api || name.startsWith(`${api}.`) || name.endsWith(`.${api}`))
  const checkFiles = (label: string, globs: readonly string[]): void => {
    for (const glob of globs) if (!hasFile(glob)) empty.push(`${label} 的 ${glob}`)
  }
  const checkCalls = (label: string, apis: readonly string[]): void => {
    for (const api of apis) if (!called(api, callees)) empty.push(`${label} 的调用名 ${api}`)
  }

  for (const adapter of Object.values(config.adapters ?? {})) {
    const face = adapter as Record<string, unknown>
    const label = String(adapter.facet)
    for (const key of ['pathSource', 'queryKeyFrom', 'eventSource']) {
      const value = face[key]
      if (typeof value === 'string' && value !== '') checkFiles(`${label}.${key}`, [value])
    }
    for (const key of ['fetchIn', 'in'] as const) {
      const value = face[key]
      if (Array.isArray(value)) checkFiles(`${label}.${key}`, value as string[])
    }
    for (const key of ['apis', 'fetchApis'] as const) {
      const value = face[key]
      // env-reads 的 apis 是**成员访问链**（`import.meta.env.X`），不在 calls 里 —— 它走下面的 reads 那一支
      if (key === 'apis' && label === 'env-reads') continue
      if (Array.isArray(value)) checkCalls(`${label}.${key}`, value as string[])
    }
    // 环境读取的"api"是**成员访问链**（`import.meta.env.X`），不在 calls 里 —— 拿 reads 判
    if (label === 'env-reads' && Array.isArray(face.apis)) {
      const apis = face.apis as string[]
      for (const api of apis) {
        if (!called(api, reads)) empty.push(`${label}.apis 的读取根 ${api}`)
      }
    }
    if (Array.isArray(face.groups)) {
      for (const group of face.groups as { name?: string; apis?: string[]; in?: string[] }[]) {
        const groupLabel = `${label}[${group.name ?? '?'}]`
        checkCalls(`${groupLabel}.apis`, group.apis ?? [])
        checkFiles(`${groupLabel}.in`, group.in ?? [])
      }
    }
  }

  // 域预设里的声明（`designSystem.numberHomes`）：名字与家两侧都可能在配置期写错
  const homes = config.params?.numberHomes as
    { name: string; names?: string[]; in?: string[] }[] | undefined
  const numberNames = [...facts.values()].flatMap((item) =>
    (item.numbers ?? []).map((number) => number.name ?? ''),
  )
  for (const home of homes ?? []) {
    checkFiles(`numberHomes[${home.name}].in`, home.in ?? [])
    for (const name of home.names ?? []) {
      if (!numberNames.includes(name)) empty.push(`numberHomes[${home.name}] 的名字 ${name}`)
    }
  }

  return empty
}

/**
 * **C01 的「文案位名单」取自哪里**（R-89）。
 *
 * 为什么需要：名单可以来自项目（`copy({ messageApis })`）或组件库适配器（`uiKit(antdKit())` 自带 antd 那份）。
 * 后者让宿主少抄一张表，但也带来一个后果：**换个没有这份数据的 kit（或干脆没装 uiKit），那一半会安静地关掉** ——
 * 报告显示"✔ 通过"，却不提它没在判。`requires` 是**整条规则**粒度，盖不住"一条规则两半"这种情况，
 * 所以把来源**自述**出来：三种取值（项目声明 / 适配器默认 / 无）互相不可混淆。
 */
export function pushCopyListNotice(
  config: Config,
  registry: { enabled: { id: string }[] },
  notices: Diagnostic[],
): void {
  // C01 没在跑就没有"名单来源"可谈（它为什么停用，报告已经明列在「因能力未声明而停用」里）
  if (!registry.enabled.some((rule) => rule.id === 'C01')) return
  const project = config.params.messageApis as string[] | undefined
  const adapter = Object.values(config.adapters ?? {}).find((item) => item.facet === 'ui-kit') as
    { id?: string; messageApis?: string[] } | undefined
  const kitCount = adapter?.messageApis?.length ?? 0
  const kitName = adapter?.id ? `uiKit(${adapter.id})` : '组件库适配器'

  let source: string
  if (project !== undefined && project.length === 0) {
    source = '`copy({ messageApis: [] })` —— 显式关掉「组件库调用里的文案」这一半'
  } else if (project !== undefined) {
    source =
      `\`copy({ messageApis })\` 项目声明 ${project.length} 条` +
      (kitCount > 0 ? `（覆盖 ${kitName} 默认 ${kitCount} 条）` : '')
  } else if (kitCount > 0) {
    source = `${kitName} 默认 ${kitCount} 条`
  } else {
    source =
      '无 ——「组件库调用里的文案」这一半没在判（写 copy({ messageApis })，或在组件库适配器里声明 messageApis）'
  }
  notices.push({ code: 'copy-list-source', text: `C01 的文案位名单：${source}` })
}
