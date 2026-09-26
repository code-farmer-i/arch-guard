import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import ts from 'typescript'

import {
  defaultFramework,
  frameworkSourceOf,
  frameworkSources,
  implementedFrameworks,
} from '../data/framework-sources.js'
import { defineAdapter } from './adapters.js'
import type { Diagnostic } from './codes.js'
import { DEFAULT_NAMING, DEFAULT_THRESHOLDS } from './defaults.js'
import type { Pack } from './pack.js'
import { resolveStructure } from './structure.js'
import { ADVICE_SIGNALS } from './advice-types.js'
import type { StructureSpec } from './structure-spec.js'
import type { Adapter, Config, ConfigOverrides, Preset } from './types.js'
import { exists, mergePresets } from './util.js'

export interface RawProjectConfig {
  /** 配置格式版本；与本工具不匹配时显式报错 */
  specVersion?: string
  presets?: Preset[]
  /**
   * 框架包（**代码**，由宿主从本体 import 进来）。省略 = 用调用方给的回退包（CLI 给的是 react pack）。
   * 一个项目只允许一个：换元框架是换 parser 与整套规则，不是叠加。
   */
  packs?: Pack[]
  /** 项目差异只写这里；与预设合并后即最终配置 */
  overrides?: ConfigOverrides
}

export interface LoadedConfig {
  config: Config
  notices: Diagnostic[]
  path: string
  /** 实际生效的框架包（恰好一个，或空数组 = 调用方直接给了规则集） */
  packs: Pack[]
}

let importCounter = 0

/** 别名只从 tsconfig 读（单一出处，避免两处真相） */
export function aliasesFromTsconfig(root: string): {
  aliases: Record<string, string>
  notice?: string
} {
  const file = join(root, 'tsconfig.json')
  if (!exists(file)) return { aliases: {} }
  try {
    /**
     * Vite 官方模板的根 tsconfig.json 只有 `references` + `files: []`，真正的 `paths` 在
     * tsconfig.app.json 里。只读根配置会让所有 `@/` 导入解析不了 —— 依赖图随之全空，
     * 图规则（S04–S09/S15/S18）在真实项目上会集体失明甚至误报「全是孤儿」。
     * 所以这里顺着 references 往下找 paths（限深，避免环）。
     */
    const readOne = (
      configPath: string,
    ): { baseUrl?: string; paths?: Record<string, string[]> } | null => {
      const read = ts.readConfigFile(configPath, (path) => ts.sys.readFile(path))
      if (read.error) return null
      return (
        (
          read.config as {
            compilerOptions?: { baseUrl?: string; paths?: Record<string, string[]> }
            references?: { path: string }[]
          }
        ).compilerOptions ?? null
      )
    }
    const readRefs = (
      configPath: string,
      depth: number,
    ): { baseUrl?: string; paths?: Record<string, string[]> } | null => {
      if (depth > 3) return null
      const read = ts.readConfigFile(configPath, (path) => ts.sys.readFile(path))
      if (read.error) return null
      const config = read.config as {
        compilerOptions?: { baseUrl?: string; paths?: Record<string, string[]> }
        references?: { path: string }[]
      }
      if (config.compilerOptions?.paths) return config.compilerOptions
      for (const reference of config.references ?? []) {
        const next = resolve(dirname(configPath), reference.path)
        const found = readRefs(exists(next) ? next : `${next}.json`, depth + 1)
        if (found) return found
      }
      return null
    }
    const options = readOne(file)?.paths
      ? (readOne(file) ?? undefined)
      : (readRefs(file, 0) ?? undefined)
    if (!options?.paths) return { aliases: {} }
    const viaReferences = !readOne(file)?.paths
    const baseUrl = (options.baseUrl ?? '.').replace(/^\.\//, '').replace(/\/$/, '')
    const aliases: Record<string, string> = {}
    for (const [key, targets] of Object.entries(options.paths)) {
      const target = targets[0]
      if (!target) continue
      const cleaned = target.replace(/\/\*$/, '').replace(/^\.\//, '')
      const alias = key.replace(/\/\*$/, '')
      aliases[alias] =
        baseUrl && baseUrl !== '.' ? `${baseUrl}/${cleaned}`.replace(/\/+/g, '/') : cleaned
    }
    return {
      aliases,
      notice: viaReferences
        ? `别名取自 tsconfig 的 references 链（根配置只有 references，${Object.keys(aliases).length} 条）`
        : `别名取自 tsconfig.json 的 paths（${Object.keys(aliases).length} 条）`,
    }
  } catch {
    return { aliases: {} }
  }
}

/** 配置格式版本 */
export const CONFIG_SPEC_VERSION = '1'

/**
 * **键白名单**（R-113）。为什么用 `Record<keyof X, true>` 写而不是散着的字符串数组：
 * 类型加了字段这里就**编译不过** —— 白名单不会悄悄落后于契约（它自己就是被门禁管着的）。
 *
 * 为什么需要它：声明型配置最怕"写了、看着对、实际没生效"。真实踩过 —— 把 `addRoles` 放进
 * `overrides.structure`（键名对、值是好的，只是放错一层），引擎静默忽略，S01 照旧报
 * "域根散件"，人只会去怀疑自己的 glob 写错了。
 */
const KNOWN_TOP_KEYS: Record<keyof RawProjectConfig, true> = {
  specVersion: true,
  presets: true,
  packs: true,
  overrides: true,
}

/** `overrides` 的可用键 = `Config` 的键（逐键覆盖）+ `addRoles`（在角色表之上追加） */
const KNOWN_OVERRIDE_KEYS: Record<keyof ConfigOverrides, true> = {
  root: true,
  srcRoot: true,
  paradigm: true,
  layout: true,
  roles: true,
  naming: true,
  thresholds: true,
  adapters: true,
  enable: true,
  disable: true,
  structure: true,
  params: true,
  entries: true,
  ignore: true,
  include: true,
  metaFramework: true,
  exceptions: true,
  adviceAllow: true,
  aliases: true,
  autoFix: true,
  addRoles: true,
}

const KNOWN_STRUCTURE_KEYS: Record<keyof StructureSpec, true> = {
  order: true,
  isolate: true,
  publicApi: true,
  publicApiUnits: true,
  segmentedGroups: true,
  reservedNames: true,
  groupCountLimits: true,
  directoryItemLimits: true,
  groupInDegree: true,
  nameCollisions: true,
  repetitiveNaming: true,
  pluralConsistency: true,
  degreeLimits: true,
  importLocality: true,
  couplingLimits: true,
  migrating: true,
  clientState: true,
  authRedirects: true,
  maxRelativeUp: true,
  generated: true,
}

/** 不认识的键直接拒（fail-closed）：声明了却没人读，等于这条纪律根本没配 */
function assertKnownKeys(
  where: string,
  value: Record<string, unknown>,
  known: Record<string, true>,
  hint = '',
): void {
  const unknown = Object.keys(value).filter((key) => !(key in known))
  if (unknown.length === 0) return
  throw new Error(
    `${where} 里有不认识的键：${unknown.join(' / ')}\n` +
      `可用：${Object.keys(known).join(' / ')}\n` +
      (hint === '' ? '' : `${hint}\n`) +
      '（不认识的键会被静默忽略 —— 与其让人去怀疑自己的 glob，不如现在就说）',
  )
}

export async function loadConfig(options: {
  root: string
  configPath?: string
  /**
   * 调用方（CLI）能提供的框架包。配置里写了 `packs` 就以配置为准；没写就用这个兜底。
   * 引擎自己不认识任何 pack —— pack 是代码，依赖方向是 pack → 引擎，不能反过来。
   */
  fallbackPacks?: Pack[]
}): Promise<LoadedConfig> {
  const { root } = options
  const path = options.configPath ? join(root, options.configPath) : join(root, 'arch.config.mjs')
  if (!exists(path)) {
    throw new Error(
      `找不到配置文件：${path}\n（arch-guard 不会回退猜测；请用 --config 指定，或在项目根放 arch.config.mjs）`,
    )
  }
  importCounter += 1
  const module = (await import(`${pathToFileURL(path).href}?v=${importCounter}`)) as {
    default?: RawProjectConfig
    presets?: Preset[]
  }
  const raw: RawProjectConfig = module.default ?? { presets: module.presets }
  if (raw.specVersion !== undefined && raw.specVersion !== CONFIG_SPEC_VERSION) {
    throw new Error(
      `配置 specVersion 不支持：${raw.specVersion}（本工具是 ${CONFIG_SPEC_VERSION}）\n` +
        '（版本不同意味着配置语义可能变了，不猜测、不降级）',
    )
  }

  assertKnownKeys('arch.config.mjs', raw as unknown as Record<string, unknown>, KNOWN_TOP_KEYS)
  if (raw.overrides !== undefined) {
    const values = raw.overrides as unknown as Record<string, unknown>
    assertKnownKeys(
      'overrides',
      values,
      KNOWN_OVERRIDE_KEYS,
      '提示：`addRoles` / `include` / `entries` 都在 **overrides 层**（与 `structure` 平级）。',
    )
    if (values.structure !== undefined) {
      assertKnownKeys(
        'overrides.structure',
        values.structure as Record<string, unknown>,
        KNOWN_STRUCTURE_KEYS,
        '提示：结构声明（层序 / 隔离 / 公开面…）写在 `structure` 里；`addRoles` 在它**外面**（overrides 层）。',
      )
    }
  }

  const notices: Diagnostic[] = []
  const presetList = raw.presets ?? []
  /**
   * 一个配置只能有**一个范式预设**。角色表是整体替换的，两个范式混用会得到
   * "角色表来自后者、`layout` 逐键混合、`structure` 取并集"的组合 —— 静默的错误组合，
   * 所以这里直接报错（fail-closed），而不是让门禁去量一个不存在的目录。
   */
  const paradigms = [...new Set(presetList.map((item) => item.paradigm).filter(Boolean))]
  if (paradigms.length > 1) {
    throw new Error(
      `一个配置只能有一个范式预设，却同时出现了：${paradigms.join(' / ')}。` +
        'canonical / library / fsd 各带一份角色表与布局，混用会得到"角色表一半、布局另一半"的错误组合。' +
        '要在某个范式之上加自己的目录，用 addRoles（追加）而不是再叠加一个范式。',
    )
  }
  const preset = mergePresets(presetList)
  const overrides = raw.overrides ?? {}

  /* ---- 框架包：恰好一个，且它与 metaFramework 只能有一处真相 ---- */
  const packs = raw.packs ?? options.fallbackPacks ?? []
  if (packs.length > 1) {
    throw new Error(
      `一个项目只允许一个框架包，配置里出现了 ${packs.map((pack) => pack.id).join(' / ')}\n` +
        '（多框架混装要按框架分别建配置，见 docs/DESIGN.md §7.5）',
    )
  }
  const pack = packs[0]
  const declaredFramework = overrides.metaFramework
  if (pack && declaredFramework !== undefined && declaredFramework !== pack.framework) {
    throw new Error(
      `metaFramework 与框架包不一致：配置写的是 ${declaredFramework}，包 ${pack.id} 实现的是 ${pack.framework}\n` +
        '（这两处只能有一个真相；直接用包，或把 overrides.metaFramework 去掉）',
    )
  }
  const metaFramework = declaredFramework ?? pack?.framework ?? defaultFramework
  const framework = frameworkSourceOf(metaFramework)
  // 认不出的取值、或「声明了某个框架却没有对应 pack」都必须 fail-closed：
  // 否则「本工具量不了这个项目」会表现为「扫到 0 个文件 → ✔ 通过」的假绿。
  if (!framework) {
    throw new Error(
      `未知的 metaFramework：${metaFramework}（已登记：${frameworkSources.map((item) => item.id).join(' / ')}）`,
    )
  }
  if (!pack && !framework.implemented) {
    throw new Error(
      `本工具还没有 ${framework.id} 框架包（现在只有 ${implementedFrameworks().join(' / ')}）：` +
        `拿它跑只会得到「0 个文件 → 通过」的假绿，所以这里直接拒绝，而不是静默通过\n` +
        '（已经有 pack 的话，在 arch.config.mjs 里用 packs: [xxxPack] 声明它）',
    )
  }

  /**
   * `Pack.adapters` 不再是一份死声明，而是一条 fail-closed 校验：
   * 宿主配的适配器 facet 必须被该 pack 支持 —— 否则就是"配了却没有任何规则读它"。
   */
  if (pack) {
    const supported = new Set(pack.adapters ?? [])
    const configured = Object.keys({ ...preset.adapters, ...overrides.adapters })
    const unknown = configured.filter((facet) => !supported.has(facet))
    if (unknown.length > 0) {
      throw new Error(
        `框架包 ${pack.id} 不支持这些适配器 facet：${unknown.join(' / ')}（支持：${[...supported].join(' / ')}）\n` +
          '（每个 facet 都必须有规则消费它 —— 没有消费者的 facet 已按"声明必须有消费者"删除）',
      )
    }
  }

  // 布局默认值属于预设（canonical），引擎不假设任何项目布局（见 §15.2 P3）
  const layout = overrides.layout ?? preset.layout
  if (!layout) {
    throw new Error('配置里没有 layout（项目布局）。请引入结构预设，例如 presets: [canonical()]')
  }

  const tsconfigAliases = aliasesFromTsconfig(root)
  if (tsconfigAliases.notice) notices.push({ code: 'config-aliases', text: tsconfigAliases.notice })

  const aliases: Record<string, string> = { ...tsconfigAliases.aliases, ...overrides.aliases }
  const entries = overrides.entries ?? preset.entries ?? [`${layout.app}/main.tsx`]
  if (exists(join(root, 'index.html'))) entries.push('index.html')

  const params = { ...preset.params, ...overrides.params }
  const adapters = { ...preset.adapters, ...overrides.adapters }
  /**
   * **合并后的适配器全部过一遍 `defineAdapter`**：预设里的本来就校验过（幂等重跑），
   * 但 `overrides.adapters` 是**绕开 kit 的通道** —— 以前它既不校验字段（拼错 = 静默失能），
   * 又能在面没登记时让引擎彻底不认识它（`facetOfCapabilityRoot` 找不到 → 能力协商看不见、
   * `--explain` 也不提它）。同一个面的两处真相已经由 `mergePresets` 拦住，这里拦住"没校验的通道"。
   */
  for (const [facet, adapter] of Object.entries(adapters)) {
    adapters[facet] = defineAdapter(facet, { ...(adapter as Record<string, unknown>) })
  }
  /**
   * **适配器缺的落点可以由范式通过 `params` 声明**（`canonical()` / `fsd()` 的 `i18nDir`）。
   *
   * 在这一处补齐，而不是让能力判定 / i18n 索引 / 报告各自兜底：下游只认"一个完整的适配器"。
   * 为什么需要它：`copy()` 不该写死默认路径 —— 否则 `canonical({ src: 'app-src' })` 时
   * i18n 目录不跟着走（和 `designSystem()` 塞三根默认值是同一类毛病）。
   */
  const i18nAdapter = adapters.i18n as { from?: string[]; resourceDir?: string } | undefined
  const usesI18nLibrary = Array.isArray(i18nAdapter?.from) && i18nAdapter.from.length > 0
  if (
    i18nAdapter &&
    usesI18nLibrary &&
    !i18nAdapter.resourceDir &&
    typeof params.i18nDir === 'string'
  ) {
    // 只在适配器**声明了 i18n 库**（`from` 非空）时补落点：
    // `noneI18nKit()` 表达的是"项目不用 i18n"，给它补落点会让 C 域照跑、C07 还会误报"声明了 i18n 却零资源"。
    adapters.i18n = { ...i18nAdapter, resourceDir: params.i18nDir } as Adapter
  }

  // 追加角色：项目自己的目录（`src/legacy/**`）加在范式角色表之上，不必整份重写
  const roles = [
    ...(overrides.roles ?? preset.roles ?? []),
    ...(preset.addRoles ?? []),
    ...(overrides.addRoles ?? []),
  ]

  const config: Config = {
    root,
    srcRoot: overrides.srcRoot ?? preset.srcRoot ?? 'src',
    layout,
    // 角色表：范式角色表**整体替换**（`overrides.roles`），再在其上**追加** addRoles
    // （预设的 addRoles 与 overrides 的 addRoles 都追加 —— 项目自己的目录不必重写范式角色表）。
    // 注：Config 上不再单独保留 `addRoles` 字段 —— 它曾被赋值却无人读，而 `roles` 已含追加结果，
    // 留着就是同一个事实的第二处存放。结构声明的校验也要看到**同一份** roles，所以先算成局部常量。
    roles,
    naming: { ...DEFAULT_NAMING, ...preset.naming, ...overrides.naming },
    thresholds: { ...DEFAULT_THRESHOLDS, ...preset.thresholds, ...overrides.thresholds },
    adapters,
    // `overrides.enable` 仍是"我全都要自己定"的总开关（整体替换）；预设之间是并集（见 mergePresets）
    enable: overrides.enable ?? preset.enable ?? 'all',
    disable: [...new Set([...(preset.disable ?? []), ...(overrides.disable ?? [])])],
    // 结构声明同样是加法：预设与 overrides 合并后**统一校验**（维度/角色必须真实存在，见 resolveStructure）
    structure: resolveStructure({
      preset: preset.structure,
      overrides: overrides.structure,
      roles,
    }),
    params,
    entries,
    ignore: [...(preset.ignore ?? []), ...(overrides.ignore ?? [])],
    // 契约扫描域：预设给默认（canonical / library 都收窄到 src），overrides 可覆盖；空 = 不限制
    include: overrides.include ?? preset.include ?? [],
    metaFramework,
    // 范式标识带进最终配置：`placementHint` / `--explain` 靠它区分「三根 / 库 / FSD」三套落点
    ...(paradigms[0] ? { paradigm: paradigms[0] } : {}),
    exceptions: [...(preset.exceptions ?? []), ...(overrides.exceptions ?? [])],
    adviceAllow: [...(overrides.adviceAllow ?? [])],
    aliases,
  }

  // 例外是唯一的宽松通道（基线已移除），所以必须指名"哪条规则对哪类文件不适用"、并写清理由
  const badException = config.exceptions.find(
    (entry) => !entry.rule?.trim() || !entry.glob?.trim() || !entry.reason?.trim(),
  )
  if (badException !== undefined) {
    throw new Error(
      'exceptions 的每一条都必须写清 rule / glob / reason —— 例外是「某条规则对某类文件不适用」，' +
        '不是「某个文件免检」：' +
        JSON.stringify(badException),
    )
  }
  const badExpiry = config.exceptions.find(
    (entry) => entry.expires !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(entry.expires),
  )
  if (badExpiry !== undefined) {
    throw new Error(`exceptions 的 expires 必须是 YYYY-MM-DD：${JSON.stringify(badExpiry)}`)
  }
  // 建议的例外（R-121）：与 exceptions 同一套纪律 —— 指名信号 / 写理由 / 到期必过期
  const badAllow = config.adviceAllow.find(
    (entry) => !entry.signal?.trim() || !entry.glob?.trim() || !entry.reason?.trim(),
  )
  if (badAllow !== undefined) {
    throw new Error(
      'adviceAllow 的每一条都必须写清 signal / glob / reason —— 它是「这条建议对这类主体不适用」，' +
        '不是「别提示我」：' +
        JSON.stringify(badAllow),
    )
  }
  const badSignal = config.adviceAllow.find(
    (entry) => !(ADVICE_SIGNALS as readonly string[]).includes(entry.signal),
  )
  if (badSignal !== undefined) {
    throw new Error(
      `adviceAllow 里不认识的信号：${badSignal.signal}（可用：${ADVICE_SIGNALS.join(' / ')}）\n` +
        '（拼错的信号等于没写 —— 与其静默不生效，不如现在就说）',
    )
  }
  const badAllowExpiry = config.adviceAllow.find(
    (entry) => entry.expires !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(entry.expires),
  )
  if (badAllowExpiry !== undefined) {
    throw new Error(`adviceAllow 的 expires 必须是 YYYY-MM-DD：${JSON.stringify(badAllowExpiry)}`)
  }

  if (config.roles.length === 0) {
    throw new Error(
      '配置里没有角色表（roles）。请至少引入一个结构预设，例如 presets: [canonical()]',
    )
  }
  if (!exists(join(root, 'package.json')))
    notices.push({
      code: 'config-no-manifest',
      text: '项目根没有 package.json：依赖类规则会被跳过',
    })

  return { config, notices, path, packs }
}
