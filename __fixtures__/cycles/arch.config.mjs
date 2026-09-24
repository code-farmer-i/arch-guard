import { library } from '../../es/index.js'

// S08 夹具：engine/a.ts ↔ engine/b.ts 互相引用 = 依赖环；utils/c.ts 是单向的合规文件。
// 环让"依赖单向"失效，也是纯图属性里唯一需要**全图**才能判的一条（其余靠角色表就够）。
export default {
  presets: [library({ modules: { engine: 1, utils: 2 }, entry: [] })],
}
