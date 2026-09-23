import { library } from '../../es/index.js'

// 通用库范式：结构就是「入口 + 项目自己声明的目录表」——没有应用的域/共享层概念。
export default {
  presets: [library({ modules: { utils: 1, core: 2 } })],
}
