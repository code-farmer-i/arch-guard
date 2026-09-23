import { canonical, designSystem, hygiene, uiKit, antdKit } from '../../es/index.js'

export default {
  presets: [
    canonical(),
    hygiene(),
    uiKit(antdKit()),
    designSystem({
      contrastPairs: [
        { fg: '--sh-alias-label-primary', bg: '--sh-alias-bg-base', usage: '正文 / 画布', min: 4.5 },
      ],
    }),
  ],
  overrides: { ignore: ['arch.config.mjs', 'expect.json'] },
}
