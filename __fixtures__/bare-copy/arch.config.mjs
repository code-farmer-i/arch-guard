import { canonical, copy, i18n, i18nextKit } from '../../es/index.js'

/**
 * 场景（声明了 i18n 才判）：JSX 里写死的界面文案 —— `<button title="保存">保存</button>`；
 * 合规：走 `t(...)`、URL、类名、单 token 都不报。
 */
export default {
  presets: [
    canonical(),
    copy({
      messageApis: ['message.success', 'notification.open'],
      messageProps: ['message', 'description'],
    }),
    i18n(i18nextKit({ resourceDir: 'src/shared/i18n/locales', languages: ['zh-CN'] })),
  ],
  overrides: { enable: ['C01'], ignore: ['arch.config.mjs', 'expect.json'] },
}
