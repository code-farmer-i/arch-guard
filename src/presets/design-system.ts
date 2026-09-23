import type { Preset } from '../engine/types.js'

export interface ContrastPair {
  fg: string
  bg: string
  usage: string
  min: number
}

export interface DesignSystemOptions {
  /** 令牌前缀，例如 --sh */
  tokenPrefix?: string
  /** 刻度令牌名，例如 --spacing */
  spacing?: string
  /** 主题名集合（明暗两套时是 ['dark','light']） */
  themes?: string[]
  /** 令牌目录（palette/foundation/scales/theme 都在这里） */
  tokenDir?: string
  /** 色板文件：颜色字面量的唯一出处 */
  paletteFile?: string
  /** 语义令牌文件：明暗两套 */
  themeFile?: string
  /** 全局样式根目录（tokens/ vendor/ base.css 等） */
  styleDir?: string
  /** 第三方组件库覆盖文件的目录（.ant-* 只许在这里） */
  vendorDir?: string
  /** 持久化 key 的文件（D08 校验它与 index.html 内联脚本一致） */
  storageFile?: string
  /** 哪些 key 必须出现在 index.html 里（默认主题 key） */
  htmlKeys?: string[]
  /**
   * 对比度基线：**项目专有**，默认空 —— 预设不替项目做决定。
   * 形状 `[{ fg, bg, usage, min }]`，token 名由项目按自己的语义层填。
   */
  contrastPairs?: ContrastPair[]
}

/**
 * 设计系统预设：令牌分层、颜色唯一出处、明暗双份、对比度、魔法数字、样式落点。
 * 规则实现在 packs 里；本预设只贡献参数（换项目改这里，不改引擎）。
 */
export function designSystem(options: DesignSystemOptions = {}): Preset {
  const tokenPrefix = options.tokenPrefix ?? '--sh'
  const styleDir = options.styleDir ?? 'src/shared/styles'
  return {
    params: {
      tokenPrefix,
      spacing: options.spacing ?? '--spacing',
      themes: options.themes ?? ['dark', 'light'],
      styleDir,
      tokenDir: options.tokenDir ?? `${styleDir}/tokens`,
      vendorDir: options.vendorDir ?? `${styleDir}/vendor`,
      paletteFile: options.paletteFile ?? `${styleDir}/tokens/palette.css`,
      themeFile: options.themeFile ?? `${styleDir}/tokens/theme.css`,
      storageFile: options.storageFile ?? 'src/shared/config/storage.ts',
      htmlKeys: options.htmlKeys ?? ['theme'],
      contrastPairs: options.contrastPairs ?? [],
      // 魔法数字（长度域）：这些属性必须走刻度令牌
      lengthProps: [
        'padding',
        'padding-top',
        'padding-right',
        'padding-bottom',
        'padding-left',
        'margin',
        'margin-top',
        'margin-right',
        'margin-bottom',
        'margin-left',
        'gap',
        'row-gap',
        'column-gap',
        'width',
        'min-width',
        'max-width',
        'height',
        'min-height',
        'max-height',
        'top',
        'right',
        'bottom',
        'left',
        'inset',
        'border-radius',
        'font-size',
        'line-height',
      ],
      // 结构性常数：0 与 1px 细线允许裸写
      allowLengthValues: ['0', '1px'],
    },
  }
}

/** 文案预设：资源目录、语言集 */
export interface CopyOptions {
  resourceDir?: string
  languages?: string[]
}

export function copy(options: CopyOptions = {}): Preset {
  return {
    params: {
      resourceDir: options.resourceDir ?? 'src/shared/i18n/locales',
      languages: options.languages ?? [],
    },
  }
}

export interface DepsOptions {
  /** fail-closed 白名单：声明后，任何未登记的运行时依赖都报错（P01） */
  allow?: string[]
  /** 明确禁用（P02）。**白名单已启用时它是多余的**，只在想给某几个库更明确的报错时用 */
  deny?: string[]
  /** 能力 → 首选方案：{ 'cli-args': 'commander', datetime: 'dayjs' } */
  capabilities?: Record<string, string>
}

export function deps(options: DepsOptions = {}): Preset {
  return {
    params: {
      // 默认两条都为空：**预设不替项目做选型决定**。
      // 项目要么用 allow（fail-closed，推荐），要么用 deny（只表达少数硬禁令），不必两者都维护。
      allow: options.allow ?? [],
      deny: options.deny ?? [],
      capabilities: options.capabilities ?? {},
    },
  }
}
