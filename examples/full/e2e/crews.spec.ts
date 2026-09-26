/**
 * e2e 层（R-112）：**只许经应用入口 / 公开面**。
 *
 * 为什么：e2e 直接 import 域内组件或 `lib/`，重构内部结构就要改 e2e —— 最后没人敢重构。
 * 这条落点由 `metrics({ tests: { homes: [{ name: 'e2e', glob: 'e2e/**\/*.spec.ts', imports: 'public' }] } })`
 * 声明，M10 判它。这里相对路径引应用入口（测试层在契约域内、layer 99，不受跨组规则约束）。
 */
import { appRouter } from '../src/app/router'

export const e2eSmoke = (): number => appRouter.routes.length
