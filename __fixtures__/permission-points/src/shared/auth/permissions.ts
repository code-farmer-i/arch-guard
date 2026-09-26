/** 权限点表的唯一出处（D29）：字面量只许写在这里 */
export const PERMISSIONS = {
  crewEdit: 'crew:edit',
  invoiceView: 'invoice:view',
} as const

export function can(point: string): boolean {
  return point.length > 0
}
