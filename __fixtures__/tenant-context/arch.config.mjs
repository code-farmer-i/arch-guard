import { callSites, canonical } from '../../es/index.js'

/**
 * 租户上下文只许在声明的落点解析（R-110 / S38 + `args`）。
 *
 * `searchParams.get` / `cookies.get` 这种 API 名字**太泛**：不声明 `args` 的话，
 * `?page=` / `?tab=` 会被一起判红；声明了 `args: ['tenantId','tenant']` 之后：
 * - `src/shared/tenant/**` 里 `get('tenantId')` → 合规（应当的落点）
 * - 页面里 `get('tenantId')` → 报（租户 id 从 URL 随手读 = 跨租户串数据的入口）
 * - 页面里 `get('page')` → **不报**（收窄生效）
 * - 页面里 `get(name)`（无字面量）→ 不报（看不见实参名，宁少报不误伤）
 */
export default {
  presets: [
    canonical(),
    callSites([
      {
        name: '租户上下文',
        apis: ['searchParams.get', 'cookies.get'],
        args: ['tenantId', 'tenant'],
        in: ['src/shared/tenant/**'],
      },
    ]),
  ],
  overrides: { enable: ['S38'], ignore: ['arch.config.mjs', 'expect.json'] },
}
