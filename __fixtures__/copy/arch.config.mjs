import { canonical, copy, hygiene } from '../../es/index.js'

export default {
  presets: [canonical(), copy(), hygiene()],
  overrides: { ignore: ['arch.config.mjs', 'expect.json'] },
}
