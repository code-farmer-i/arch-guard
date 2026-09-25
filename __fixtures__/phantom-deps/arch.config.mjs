import { canonical, deps } from '../../es/index.js'

/**
 * 场景：`dayjs` 写在 package.json 里（合规），但某个文件 import 了 `left-pad` ——
 * 它靠别的包间接装着，本地能跑、换机器就崩。声明 deps() 后 P03 报在**引用它的那一行**。
 */
export default {
  presets: [canonical(), deps({})],
  overrides: { enable: ['P03'], ignore: ['arch.config.mjs', 'expect.json'] },
}
