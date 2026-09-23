import { canonical, hygiene, deps } from '../../es/index.js'

export default {
  presets: [canonical(), hygiene(), deps({ capabilities: { datetime: 'dayjs' } })],

  overrides: { enable: ['P06'] },
}
