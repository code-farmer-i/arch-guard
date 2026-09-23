import { canonical, hygiene, uiKit, noneKit } from '../../es/index.js'

export default {
  presets: [canonical(), hygiene(), uiKit(noneKit())],
}
