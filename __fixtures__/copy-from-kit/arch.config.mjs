import { canonical, i18n, i18nextKit, uiKit, antdKit } from '../../es/index.js'

/**
 * 场景：**文案位名单由组件库适配器给**，宿主一个字都不用抄。
 *
 * 违规：`message.success('保存成功')`（直接实参）与 `notification.open({ message: '保存失败' })`（对象实参）——
 * 项目**没有**写 `copy({ messageApis, messageProps })`，但 `uiKit(antdKit())` 已经声明了 antd 的那份。
 * 合规：`t(...)` 进来的键不算；`key` / `duration` 这类非文案属性不算（名单只收文案属性）。
 */
export default {
  presets: [
    canonical(),
    i18n(i18nextKit({ resourceDir: 'src/shared/i18n/locales', languages: ['zh-CN'] })),
    uiKit(antdKit()),
  ],
  overrides: { enable: ['C01'], ignore: ['arch.config.mjs', 'expect.json'] },
}
