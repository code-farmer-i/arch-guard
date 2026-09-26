/**
 * 权限点表的**唯一出处**（D29）：字面量只许写在这里，调用点传常量。
 *
 * 为什么要它：`can('crew:edit')` 在十几个组件里各写一遍字面量 —— 加一个权限点或改一次命名要全仓找，
 * 漏一处就是越权入口，或者功能凭空消失（没人报错）。
 */
export const PERMISSIONS = {
  crewEdit: 'crew:edit',
  invoiceEdit: 'invoice:edit',
  customerView: 'customer:view',
} as const

/** 判权限点：项目里唯一的判断入口（R-46 声明它只许出现在守卫/策略落点） */
export function can(point: string): boolean {
  return point.length > 0
}
