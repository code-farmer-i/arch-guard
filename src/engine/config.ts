import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import ts from 'typescript'

import type { Config, Preset, Thresholds } from './types.js'
import { exists, mergePresets } from './util.js'

export interface RawProjectConfig {
  presets?: Preset[]
  /** 项目差异只写这里；与预设合并后即最终配置 */
  overrides?: Partial<Config>
}

export interface LoadedConfig {
  config: Config
  notices: string[]
  path: string
}

const DEFAULT_THRESHOLDS: Thresholds = {
  fileLines: 400,
  viewLines: 320,
  functionLines: 150,
  exportsPerFile: 6,
  componentsPerFile: 3,
}

const DEFAULT_NAMING = {
  hookPrefix: 'use',
  viewSuffix: 'Page',
  pageComponentSuffix: 'Page',
}

let importCounter = 0

/** 别名只从 tsconfig 读（单一出处，避免两处真相） */
export function aliasesFromTsconfig(root: string): { aliases: Record<string, string>; notice?: string } {
  const file = join(root, 'tsconfig.json')
  if (!exists(file)) return { aliases: {} }
  try {
    const read = ts.readConfigFile(file, (path) => ts.sys.readFile(path))
    if (read.error) return { aliases: {} }
    const options = (read.config as { compilerOptions?: { baseUrl?: string; paths?: Record<string, string[]> } }).compilerOptions
    if (!options?.paths) return { aliases: {} }
    const baseUrl = (options.baseUrl ?? '.').replace(/^\.\//, '').replace(/\/$/, '')
    const aliases: Record<string, string> = {}
    for (const [key, targets] of Object.entries(options.paths)) {
      const target = targets[0]
      if (!target) continue
      const cleaned = target.replace(/\/\*$/, '').replace(/^\.\//, '')
      const alias = key.replace(/\/\*$/, '')
      aliases[alias] = baseUrl && baseUrl !== '.' ? `${baseUrl}/${cleaned}`.replace(/\/+/g, '/') : cleaned
    }
    return { aliases, notice: `别名取自 tsconfig.json 的 paths（${Object.keys(aliases).length} 条）` }
  } catch {
    return { aliases: {} }
  }
}

export async function loadConfig(options: { root: string; configPath?: string }): Promise<LoadedConfig> {
  const { root } = options
  const path = options.configPath ? join(root, options.configPath) : join(root, 'arch.config.mjs')
  if (!exists(path)) {
    throw new Error(`找不到配置文件：${path}\n（arch-guard 不会回退猜测；请用 --config 指定，或在项目根放 arch.config.mjs）`)
  }
  importCounter += 1
  const module = (await import(`${pathToFileURL(path).href}?v=${importCounter}`)) as { default?: RawProjectConfig; presets?: Preset[] }
  const raw: RawProjectConfig = module.default ?? { presets: module.presets }

  const notices: string[] = []
  const preset = mergePresets(raw.presets ?? [])
  const overrides = raw.overrides ?? {}
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
    exempt: [...(preset.exempt ?? []), ...(overrides.exempt ?? [])],
    aliases,
    baselineFile: overrides.baselineFile ?? 'arch.baseline.json',
  }

  if (config.roles.length === 0) {
    throw new Error('配置里没有角色表（roles）。请至少引入一个结构预设，例如 presets: [canonical()]')
  }
  if (!exists(join(root, 'package.json'))) notices.push('项目根没有 package.json：依赖类规则会被跳过')

  return { config, notices, path }
}
