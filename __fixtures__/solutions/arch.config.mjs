import {
  cssModulesKit,
  dataLayer,
  library,
  reactQueryKit,
  reactRouterKit,
  router,
  styles,
} from '../../es/index.js'

// P12 夹具：三个方案面各登记一个方案，代码里却混进了同类库。
//   router      → 登记 react-router（含 react-router-dom），代码里 import wouter
//   data-layer  → 登记 @tanstack/react-query，代码里 import swr
//   styles      → 登记 CSS Module，代码里 import styled-components
// 合规文件只 import 登记过的包。
export default {
  presets: [
    library({ modules: { engine: 1 }, entry: [] }),
    router(reactRouterKit()),
    dataLayer(reactQueryKit()),
    styles(cssModulesKit()),
  ],
}
