import { canonical, cssModulesKit, designSystem, styles } from '../../es/index.js'

/**
 * 样式方案是 **CSS Module + Sass**：组件样式文件的形态是 `*.module.scss`。
 *
 * `styles(cssModulesKit({ modulePatterns, examples }))` 声明了这件事，于是 D16 / D17 认 `.module.scss`：
 * - `Card.module.scss` 是合法的组件样式（不报）
 * - `globals.css` 仍在组件目录里裸放（D16 报）
 *
 * 若这个声明不生效（规则还写死 `.module.css`），`Card.module.scss` 与 `Bad.module.scss`
 * 都会被 D16 报成"组件目录里的全局样式" —— 夹具期望因此是钉死这条的。
 * 正则类字段必须自己给样例：样例会拿**真正则**去验证（写歪了在这里就报，不在规则里静默失效）。
 */
export default {
  presets: [
    canonical(),
    designSystem(),
    styles(
      cssModulesKit({
        modulePatterns: ['\\.module\\.scss$'],
        examples: {
          modulePatterns: {
            hit: ['src/shared/components/ui/Card.module.scss'],
            miss: ['src/shared/components/ui/Card.tsx'],
          },
        },
      }),
    ),
  ],
  overrides: {
    enable: ['D16', 'D17'],
    ignore: ['arch.config.mjs', 'expect.json'],
  },
}
