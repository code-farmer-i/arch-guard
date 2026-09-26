/**
 * 权限点表的**唯一出处**（D29）：字面量只许写在这里，调用点传常量。
 * 与 canonical 样板对称：`permissions({ apis: ['can'], source })` 一行声明，其余全在调用点。
 */
export const PERMISSIONS = {
  crewEdit: 'crew:edit',
  orderExport: 'order:export',
} as const

/** 项目里唯一的权限判断入口（R-46 声明它只许出现在守卫/策略落点） */
export function can(point: string): boolean {
  return point.length > 0
}
