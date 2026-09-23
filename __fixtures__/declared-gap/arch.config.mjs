import { antdKit, canonical, copy, designSystem, hygiene, uiKit } from '../../es/index.js'

// 声明了三样东西，项目里一样都没有：
//   - copy()          → C 域零资源        (C07)
//   - designSystem()  → 令牌路径零匹配    (D21)
//   - uiKit(antdKit())→ 组件库零使用      (P11)
// 三条规则把这种「以为在跑、其实没跑」变成可见的 warn。
export default {
  presets: [
    canonical(),
    hygiene(),
    copy({ resourceDir: 'src/i18n/locales', languages: ['zh-CN', 'en'] }),
    designSystem({ styleDir: 'src/styles' }),
    uiKit(antdKit()),
  ],
}
