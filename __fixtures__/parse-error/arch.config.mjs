import { canonical, hygiene } from '../../es/index.js'

export default {
  presets: [canonical(), hygiene()],

  overrides: { enable: ['S00'] },
}
