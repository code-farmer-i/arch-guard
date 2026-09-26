/**
 * **`apis` 声明的调用名怎么匹配** —— 全仓唯一实现（规则与"声明 0 命中"自述共用）。
 *
 * 以前这里有**四份**副本、两套规则：`callSites` 与自述认"整名 / 对象前缀 / 方法后缀"，
 * 而 D24 / D25 / D29 只认"整名 / 方法后缀" —— 于是 `can.has('crew:edit')` 这种前缀形态
 * **规则不判、自述却认为命中**（自述替漏判打掩护，实测于 2026-09-25）。
 *
 * 三种形态（都带 `.` 边界，**不是子串**）：
 *
 * - **整名**：`fetch` ↔ `fetch`
 * - **对象前缀**：`localStorage` ↔ `localStorage.getItem`（内置对象的方法名不必逐个声明）
 * - **方法后缀**：`invalidateQueries` ↔ `queryClient.invalidateQueries`（接收者变量名由项目决定）
 *
 * 因此 `can` **不会**匹配 `cancel`；但 `can` 会同时匹配 `permission.can(...)` 与 `can.has(...)` ——
 * 泛名字的"同名不同义"用 `args`（R-110）收窄，而不是靠匹配形态去猜（N-10 记过同一件事）。
 */
export const apiMatchOf = (callee: string, apis: readonly string[]): string | null =>
  apis.find(
    (api) => callee === api || callee.startsWith(`${api}.`) || callee.endsWith(`.${api}`),
  ) ?? null

/** 只要"有没有命中"的场合用它（自述） */
export const matchesApi = (callee: string, apis: readonly string[]): boolean =>
  apiMatchOf(callee, apis) !== null
