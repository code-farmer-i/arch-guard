import { canonical, hygiene, uiKit, antdKit } from '../../es/index.js'

// H06–H10 夹具：脱离上下文的全局 API、假异步与随机、硬编码地址、假数据、手搓时间格式化
export default {
  presets: [canonical(), hygiene(), uiKit(antdKit())],
  overrides: { ignore: ['arch.config.mjs', 'package.json', 'tsconfig.json', 'expect.json'] },
}
