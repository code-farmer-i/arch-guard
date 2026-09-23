import { canonical, designSystem } from '../../es/index.js'

export default {
  presets: [canonical(), designSystem()],
  overrides: {
    enable: ['D12', 'D13', 'D14', 'D16', 'D17', 'D18'],
    ignore: ['arch.config.mjs', 'expect.json'],
  },
}
