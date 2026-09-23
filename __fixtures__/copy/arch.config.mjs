import { canonical, copy, hygiene } from '../../es/index.js'

export default {
  presets: [canonical(), copy(), hygiene()],
  overrides: {
    enable: ['C01', 'C02', 'C03', 'C04', 'C05', 'C06'],
    ignore: ['arch.config.mjs', 'expect.json'],
  },
}
