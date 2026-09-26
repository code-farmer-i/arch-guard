import { analytics, canonical } from '../../es/index.js'

/**
 * 埋点上报不许写在渲染体里（R-101 / S46）。
 *
 * - `GoodPage`：在 `useEffect` 里上报（合规）
 * - `BadPage`：在渲染体里直接 `sendEvent(...)`（每次重渲染都会上报，StrictMode 还双调用）
 */
export default {
  presets: [
    canonical(),
    analytics({ apis: ['sendEvent'], eventSource: 'src/shared/lib/analytics/events.ts' }),
  ],
  overrides: { enable: ['S46'], ignore: ['arch.config.mjs', 'expect.json'] },
}
