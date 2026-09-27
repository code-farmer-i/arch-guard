import { canonical, createRule } from '../../es/index.js'

/**
 * **自定义规则**（R-143 / ADR-0009）：宿主加自己的规则**只写一行** `overrides.customRules`。
 *
 * 为什么值得一个夹具：这条通道以前不存在 —— 宿主只能自造一个"框架包"
 * （自称实现某形态 + 手工转发 adapters），或走程序化入口（CLI 从此看不见这些规则）。
 * 这个夹具证明：追加的规则**真的在判**（`expect.json` 里那条 S97 就是它报的）。
 *
 * `enable: ['S97']` 是有意的：把内置规则全关掉，夹具只盯"追加的规则跑没跑"。
 */
const noSharedBarrel = createRule({
  id: 'S97',
  domain: 'structure',
  level: 'L1',
  severity: 'error',
  title: 'shared 下不许出现 barrel',
  hint: 'shared 的目录索引会削弱 tree-shaking，也把"谁依赖什么"变模糊：直接从具体文件引',
  run: (ctx) =>
    ctx.records
      .filter((record) => /^src\/shared\/.*index\.ts$/.test(record.rel))
      .map((record) => ({
        rule: 'S97',
        file: record.rel,
        line: 1,
        text: 'shared 下的 barrel：目录索引不要放这里',
        hint: '把导出写进具体文件，由调用方直接引它',
      })),
})

export default {
  specVersion: '2',
  sourceForm: 'typescript',
  presets: [canonical()],
  overrides: {
    customRules: [noSharedBarrel],
    enable: ['S97'],
    ignore: ['arch.config.mjs', 'expect.json'],
  },
}
