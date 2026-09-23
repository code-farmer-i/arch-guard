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
  overrides: {
    enable: ['D01', 'D02', 'D03', 'D04', 'D05', 'D06', 'D07', 'D08', 'D09', 'D10', 'D10b', 'D11'],
    ignore: ['arch.config.mjs', 'expect.json'],
  },
}
