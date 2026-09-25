import { capabilityOf, wheelFingerprints } from '../data/wheel-fingerprints.js'
import { AdapterError } from '../engine/adapters.js'
import type { FingerprintOverride } from '../engine/deps.js'
import type { Preset } from '../engine/types.js'

export interface ContrastPair {
  fg: string
  bg: string
  usage: string
  min: number
}

export interface DesignSystemOptions {
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
  /**
   * 数值三族的白名单（D12 长度 / D13 层级 / D14 时长）：**声明哪一族才判哪一族**。
   * 例：`[{ rule: 'D12', allow: ['4px','8px','12px'] }, { rule: 'D13', allow: ['1','10'] }]`
   */
  valueWhitelists?: { rule: string; allow: string[] }[]
}

/**
 * 设计系统预设：令牌分层、颜色唯一出处、明暗双份、对比度、魔法数字、样式落点。
 * 规则实现在 packs 里；本预设只贡献参数（换项目改这里，不改引擎）。
 */
export function designSystem(options: DesignSystemOptions = {}): Preset {
  /**
   * **落点由范式声明，域预设只写用户显式给的**（见 `Preset.paradigm`）。
   *
   * 为什么：`canonical()` 与 `fsd()` 各有惯用落点（三根是 `shared/styles`，FSD 是 `shared/ui/styles`）。
   * 如果这里塞三根默认值，`[fsd(), designSystem()]` 就会被悄悄改回三根路径 —— **组合起来就不符合所选规范了**（实测过）。
   * 谁都没声明时，`designParams()` 的内置默认兜底（仍是三根路径），行为与旧版一致。
   */
  const paths: Record<string, unknown> = {}
  if (options.styleDir) {
    // 给了 styleDir 时其余路径从它推导（少写几行）；任何一项显式给出都直接采纳
    paths.styleDir = options.styleDir
    paths.tokenDir = options.tokenDir ?? `${options.styleDir}/tokens`
    paths.vendorDir = options.vendorDir ?? `${options.styleDir}/vendor`
    paths.paletteFile = options.paletteFile ?? `${options.styleDir}/tokens/palette.css`
    paths.themeFile = options.themeFile ?? `${options.styleDir}/tokens/theme.css`
  } else {
    if (options.tokenDir) paths.tokenDir = options.tokenDir
    if (options.vendorDir) paths.vendorDir = options.vendorDir
    if (options.paletteFile) paths.paletteFile = options.paletteFile
    if (options.themeFile) paths.themeFile = options.themeFile
  }
  if (options.storageFile) paths.storageFile = options.storageFile
  return {
    /**
     * 本预设贡献 **D 域全部规则**（多个预设之间是**并集**，见 `Preset.enable` 的说明）。
     *
     * `D22` / `D23`（缓存键 / 路由路径的唯一出处）由 `dataLayer()` / `router()` 那侧**也**启用 ——
     * 域预设列全、方案面预设列自己消费的那几条，两处都列不冲突（并集），
     * 保证「只装设计系统」和「只装方案适配器」两种配法都不会漏挂规则（`engine-unit` 那条守卫盯着）。
     * 它们真正的开关是**能力**：没声明 `queryKeyFrom` / `pathSource` 就明列停用。
     */
    enable: [
      'D03',
      'D01',
      'D09',
      'D04',
      'D05',
      'D06',
      'D07',
      'D08',
      'D10',
      'D10b',
      'D11',
      'D16',
      'D17',
      'D21',
      'D22',
      'D23',
      'D12',
      'D13',
      'D14',
      'D24',
    ],
    params: {
      /**
       * 显式标记「项目声明了设计系统」。D21 靠它把两种情况分开：
       * - 没加这个预设 → D 域安静空转（项目本来就不做设计系统，不该被吵）
       * - 加了但路径指空 → 报出来（否则门禁显示"通过"，其实 D 域一条都没查）
       * 光看其余参数分不出来：`designParams()` 带内置默认路径。
       */
      designSystemDeclared: true,
      themes: options.themes ?? ['dark', 'light'],
      htmlKeys: options.htmlKeys ?? ['theme'],
      valueWhitelists: options.valueWhitelists ?? [],
      contrastPairs: options.contrastPairs ?? [],
      // 落点：用户显式给的（paths）放最后，压过任何默认推导
      ...paths,
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
  /**
   * 开启「声明但未使用」（P08，warn）。**默认关**：只按 import 判会误伤
   * 自动 JSX 运行时（react）、副作用型依赖与只在构建配置里用的包。
   */
  unusedDeps?: boolean
  /**
   * 覆盖某个能力的**指纹证据**（R-73）：加 / 删 pattern、改 API 名清单、放宽 `allowOwn`。
   * 首选方案不在这里 —— 那是 `capabilities` 的活（一个事实一个出处）。
   */
  fingerprints?: FingerprintOverride[]
}

export function deps(options: DepsOptions = {}): Preset {
  // 覆盖的校验放在这里（宿主写配置的地方）而不是规则里：
  // 能力名拼错、pattern 写不成正则 —— 都是"配了但不生效"，必须当场报错
  for (const override of options.fingerprints ?? []) {
    const entry = capabilityOf(override.capability)
    if (!entry) {
      throw new AdapterError(
        `deps() 的指纹覆盖指向不存在的能力「${override.capability}」\n` +
          `（内置能力：${wheelFingerprints.map((item) => item.capability).join(' / ')}）`,
      )
    }
    for (const field of [
      'addSyntax',
      'removeSyntax',
      'addSoftSyntax',
      'removeSoftSyntax',
    ] as const) {
      for (const pattern of override[field] ?? []) {
        try {
          new RegExp(pattern)
        } catch {
          throw new AdapterError(
            `deps() 的指纹覆盖 ${field} 里「${pattern}」不是合法正则 —— 这条覆盖永远不会命中`,
          )
        }
      }
    }
  }
  return {
    enable: ['P01', 'P02', 'P03', 'P04', 'P05', 'P06', 'P07', 'P08', 'P11', 'P12'],
    params: {
      // 默认两条都为空：**预设不替项目做选型决定**。
      // 项目要么用 allow（fail-closed，推荐），要么用 deny（只表达少数硬禁令），不必两者都维护。
      allow: options.allow ?? [],
      deny: options.deny ?? [],
      capabilities: options.capabilities ?? {},
      fingerprints: options.fingerprints ?? [],
      unusedDeps: options.unusedDeps === true,
    },
  }
}
