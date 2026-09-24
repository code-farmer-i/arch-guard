import { DEFAULT_MODULE_PATTERNS } from '../../data/face-forms.js'
import { AdapterError, defineAdapter, defineFacet } from '../../engine/adapters.js'
import type { AdapterExamples, StylesAdapter } from '../../engine/types.js'

defineFacet('styles', {
  fields: ['packages', 'modulePatterns', 'examples'],
  capabilityRoot: 'styles',
})

/** 默认形态的样例（正则类字段必须给 hit / miss，见 §7.4 第 4 条） */
const DEFAULT_EXAMPLES: AdapterExamples = {
  modulePatterns: {
    hit: ['src/shared/components/ui/Card.module.css'],
    miss: ['src/shared/components/ui/Card.tsx'],
  },
}

export interface CssModulesKitOptions {
  /**
   * 组件样式文件的形态（正则）。缺省 `*.module.css`。
   *
   * 换成 `['\\.module\\.scss$']` 就切到 Sass —— D16 / D17 的词汇随之改变，
   * 而不是把 `.module.scss` 当成"组件目录里的全局样式"误报。
   */
  modulePatterns?: string[]
  /**
   * 自定义 `modulePatterns` 时**必须**给样例：样例会拿真正则去跑（`defineAdapter` 校验），
   * 是"正则写歪了"唯一能被抓住的地方 —— 复制一份默认样例只会骗过校验，所以这里不兜底。
   */
  examples?: AdapterExamples
}

/**
 * CSS Module 适配器：它是"没有 npm 包"的方案，`packages` 为空 ——
 * 声明它的作用是把 `styles` 面登记成"已选 CSS Module"，从而让 P12 拦住混进来的同类样式库；
 * 另外它还声明 D16 / D17 认的**组件样式形态**（`modulePatterns`）。
 */
export function cssModulesKit(options: CssModulesKitOptions = {}): StylesAdapter {
  const modulePatterns = options.modulePatterns ?? DEFAULT_MODULE_PATTERNS
  if (options.modulePatterns && !options.examples) {
    throw new AdapterError(
      'cssModulesKit：声明了自定义 modulePatterns 就必须同时给 examples（hit / miss 各一条真文件路径）\n' +
        '—— 正则的 hit / miss 会拿真正则去验证，这是"写歪了却不生效"唯一能被抓住的地方',
    )
  }
  return defineAdapter<StylesAdapter>('styles', {
    id: 'css-modules',
    specVersion: '1',
    packages: [],
    modulePatterns: [...modulePatterns],
    examples: options.examples ?? DEFAULT_EXAMPLES,
  })
}
