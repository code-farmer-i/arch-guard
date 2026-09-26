import { AdapterError, defineAdapter, defineFacet } from '../engine/adapters.js'
import type { GenericAdapter, Preset } from '../engine/types.js'

/**
 * **权限点**预设：权限点名字只许出现在声明的**唯一出处**（D29）。
 *
 * 场景：`can('crew:edit')` 在 12 个组件里各写一遍字面量 —— 加一个权限点 / 改一次命名要全仓找，
 * 漏一处就是越权入口或功能凭空消失。与缓存键（D22）/ 路由路径（D23）/ 事件名（D24）/ 端点（D25）
 * 同一族：**名字有唯一出处，调用点引用常量**。
 *
 * 与 R-46（S38 `callSites`）的分工：那条管"权限**判断**写在哪儿"（判断只许出现在守卫里），
 * 这条管"权限**点叫什么、在哪儿定义"（字面量只许出现在表里）—— 两件事，各一条。
 */
defineFacet('permissions', {
  fields: ['apis', 'source', 'examples'],
  capabilityRoot: 'permissions',
})

export interface PermissionsOptions {
  /** 哪些调用算"判权限点"：`['can', 'hasPermission', 'hasAbility']` */
  apis: string[]
  /** 权限点表的唯一出处（文件路径）：`src/shared/auth/permissions.ts` */
  source: string
}

export function permissions(options: PermissionsOptions): Preset {
  const apis = options.apis ?? []
  if (apis.length === 0 || !options.source) {
    throw new AdapterError(
      'permissions() 需要同时给 apis 与 source：前者是"哪些调用在判权限点"，后者是"权限点表写在哪"\n' +
        '（缺一个这条门禁就静默停用 —— 与其这样，不如不写这个预设）',
    )
  }
  return {
    enable: ['D29'],
    adapters: {
      permissions: defineAdapter<GenericAdapter>('permissions', {
        id: 'declared',
        specVersion: '1',
        apis: [...apis],
        source: options.source,
      }),
    },
  }
}
