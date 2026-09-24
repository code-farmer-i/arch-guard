import { fsd } from '../../es/index.js'

// steiger 对齐夹具：一棵把社区 linter 的各类违规形态都摆出来的 FSD 树。
// 判定全部来自 `fsd()` 的声明（角色表 + structure），规则里没有一行 FSD 字面量。
export default {
  presets: [fsd()],
  overrides: {
    // 阈值调小：预设给的是社区默认（切片 20 / shared/lib 子项 15），
    // 否则夹具要堆几百个文件才能触到阈值 —— 这是宿主调数值的官方通道。
    structure: {
      groupCountLimits: [{ dimension: 'slice', max: 3 }],
      directoryItemLimits: [{ role: 'fsd:shared:lib', max: 1 }],
    },
  },
}
