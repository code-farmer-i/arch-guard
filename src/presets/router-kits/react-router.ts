import { DEFAULT_ROUTE_FILES } from '../../data/face-forms.js'
import { defineAdapter, defineFacet } from '../../engine/adapters.js'
import type { RouterAdapter } from '../../engine/types.js'

// 面由**预设**登记（E2）：加一个面不改引擎
defineFacet('router', {
  fields: ['packages', 'routeFiles', 'pathSource', 'pathProps', 'navigateCalls', 'examples'],
  capabilityRoot: 'router',
})

export interface ReactRouterKitOptions {
  /**
   * 域的**公开面入口**文件名（S03 / S04 / S05 / S14 / S15 的词汇）。缺省 `routes.ts` / `routes.tsx`。
   *
   * 什么时候要改：入口不叫 `routes.*` 的项目（`router.ts`、嵌套 `routes/index.ts`、`entry.ts`…）。
   * 改了之后**角色表也要跟上**（入口文件得命中一个 `slot: 'routes'` 的角色，见 `canonical()` 的角色
   * 与 DESIGN §7.2(2.1)），否则 S12 / S13 这类**槽位规则**看不到它。
   */
  routeFiles?: string[]
  /**
   * **路由路径的唯一出处**（如 `src/shared/config/paths.ts`）→ 启用 D23。
   *
   * 落点是**项目决定**（同 `designSystem({ styleDir })`），所以由这里传入而不是 kit 写死；
   * 不传 → D23 明列停用（`requires`），不空转。
   */
  pathSource?: string
  /** 承载路径的属性名（缺省 `path` / `to`） */
  pathProps?: string[]
  /** 触发跳转的调用名（缺省 `navigate` / `router.push`…） */
  navigateCalls?: string[]
}

/**
 * react-router 适配器：库名只许出现在这里（P4 自检拦住别处）。
 *
 * `routeFiles` 是**域的公开面入口**词汇：react-router v7 既写 `routes.tsx`（组件式）
 * 也写 `routes.ts`（配置式），与范式角色表 `modules/{domain}/routes.{ts,tsx}` 是同一份词汇 ——
 * 默认值取自 `src/data/face-forms.ts`，不在这里再抄一遍。
 */
export function reactRouterKit(options: ReactRouterKitOptions = {}): RouterAdapter {
  return defineAdapter<RouterAdapter>('router', {
    id: 'react-router',
    specVersion: '1',
    packages: ['react-router', 'react-router-dom'],
    routeFiles: [...(options.routeFiles ?? DEFAULT_ROUTE_FILES)],
    ...(options.pathSource ? { pathSource: options.pathSource } : {}),
    ...(options.pathProps ? { pathProps: [...options.pathProps] } : {}),
    ...(options.navigateCalls ? { navigateCalls: [...options.navigateCalls] } : {}),
  })
}
