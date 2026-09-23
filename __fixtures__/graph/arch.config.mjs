import { canonical, hygiene } from '../../es/index.js'

export default {
  presets: [canonical(), hygiene()],
  overrides: { ignore: ['arch.config.mjs', 'expect.json'] },
}
