import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import ts from 'typescript'

import {
  defaultFramework,
  frameworkSourceOf,
  frameworkSources,
  implementedFrameworks,
} from '../data/framework-sources.js'
import type { Pack } from './pack.js'
import type { Config, Preset, Thresholds } from './types.js'
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
  overrides?: Partial<Config>
}

export interface LoadedConfig {
  config: Config
  notices: string[]
  path: string
  /** 实际生效的框架包（恰好一个，或空数组 = 调用方直接给了规则集） */
  packs: Pack[]
}

const DEFAULT_THRESHOLDS: Thresholds = {
  fileLines: 500,
  viewLines: 500,
  functionLines: 150,
  exportsPerFile: 6,
  componentsPerFile: 3,
}

const DEFAULT_NAMING = {
  hookPrefix: 'use',
  viewSuffix: 'Page',
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

  const notices: string[] = []
  const preset = mergePresets(raw.presets ?? [])
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

  // 布局默认值属于预设（canonical），引擎不假设任何项目布局（见 §15.2 P3）
  const layout = overrides.layout ?? preset.layout
  if (!layout) {
    throw new Error('配置里没有 layout（项目布局）。请引入结构预设，例如 presets: [canonical()]')
  }

  const tsconfigAliases = aliasesFromTsconfig(root)
  if (tsconfigAliases.notice) notices.push(tsconfigAliases.notice)

  const aliases: Record<string, string> = { ...tsconfigAliases.aliases, ...overrides.aliases }
  const entries = overrides.entries ?? preset.entries ?? [`${layout.app}/main.tsx`]
  if (exists(join(root, 'index.html'))) entries.push('index.html')

  const config: Config = {
    root,
    srcRoot: overrides.srcRoot ?? preset.srcRoot ?? 'src',
    layout,
    roles: overrides.roles ?? preset.roles ?? [],
    naming: { ...DEFAULT_NAMING, ...preset.naming, ...overrides.naming },
    thresholds: { ...DEFAULT_THRESHOLDS, ...preset.thresholds, ...overrides.thresholds },
    layers: overrides.layers ?? preset.layers ?? {},
    adapters: { ...preset.adapters, ...overrides.adapters },
    enable: overrides.enable ?? preset.enable ?? 'all',
    params: { ...preset.params, ...overrides.params },
    entries,
    ignore: [...(preset.ignore ?? []), ...(overrides.ignore ?? [])],
    // 契约扫描域：预设给默认（canonical / library 都收窄到 src），overrides 可覆盖；空 = 不限制
    include: overrides.include ?? preset.include ?? [],
    metaFramework,
    exempt: [...(preset.exempt ?? []), ...(overrides.exempt ?? [])],
    aliases,
    baselineFile: overrides.baselineFile ?? 'arch.baseline.json',
  }

  if (config.roles.length === 0) {
    throw new Error(
      '配置里没有角色表（roles）。请至少引入一个结构预设，例如 presets: [canonical()]',
    )
  }
  if (!exists(join(root, 'package.json')))
    notices.push('项目根没有 package.json：依赖类规则会被跳过')

  return { config, notices, path, packs }
}
