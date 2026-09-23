import type { Preset } from '../engine/types.js'

export interface DesignSystemOptions {
  /** 令牌前缀，例如 --sh */
  tokenPrefix?: string
  /** 刻度令牌名，例如 --spacing */
  spacing?: string
  /** 主题名集合（明暗两套时是 ['dark','light']） */
  themes?: string[]
  /** 允许出现颜色字面量的唯一文件 */
  paletteFile?: string
  /** 允许出现第三方选择器的目录 */
  vendorDir?: string
}

/**
 * 设计系统预设：令牌分层、颜色唯一出处、明暗双份、对比度、魔法数字。
 * 规则实现在 packs 里；本预设只贡献参数（换项目改这里，不改引擎）。
 */
export function designSystem(options: DesignSystemOptions = {}): Preset {
  return {
    params: {
      tokenPrefix: options.tokenPrefix ?? '--sh',
      spacing: options.spacing ?? '--spacing',
      themes: options.themes ?? ['dark', 'light'],
      paletteFile: options.paletteFile ?? 'src/shared/styles/tokens/palette.css',
      vendorDir: options.vendorDir ?? 'src/shared/styles/vendor',
    },
  }
}

/** 文案预设：资源目录、语言集、是否禁止裸文本 */
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

/** 依赖选型预设：白名单来自 AGENTS.md 选型表，机读真相在这里 */
export interface DepsOptions {
  allow?: string[]
  deny?: string[]
}

export function deps(options: DepsOptions = {}): Preset {
  return {
    params: {
      allow: options.allow ?? [],
      deny: options.deny ?? ['axios', 'swr', 'redux', 'mobx', 'jotai', 'react-hook-form'],
    },
  }
}
