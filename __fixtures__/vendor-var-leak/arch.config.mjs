import { canonical, designSystem, uiKit, antdKit } from '../../es/index.js'

// 夹具：**组件库变量漏到 vendor 之外**（D10 的变量那一半）。
// 两条断言：
//   ① D10 必须报（变量定义 `--ant-local` 与引用 `var(--ant-color-primary)` 都在 vendor 之外）；
//   ② P11 **不许**误报「零使用」—— vendor 目录里确实用了 `--ant-*`，而它不在文件第一行
//      （曾经用整份文件文本 test `^--ant-`，只在文件开头才命中 → 误报）。
export default {
  presets: [canonical(), designSystem(), uiKit(antdKit())],
  overrides: {
    enable: ['D10', 'P11'],
    ignore: ['arch.config.mjs', 'expect.json'],
  },
}
