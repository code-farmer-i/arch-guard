/**
 * **这条路是不是测试文件** —— 全仓唯一实现（以前 S38 与架构建议各有一份，**语义已经分叉**：
 * 一份只认 `.test.` / `.spec.`，另一份多认 `__tests__/`）。
 *
 * 这类"同名不同义"比单纯的重复更坏：改了其中一处，另一处不会跟着变。
 *
 * **权威来源是配置里声明的 `test` 角色**（`record.role === 'test'`）—— 本函数是
 * "手上只有路径、拿不到 records"（如扫描域外的文件、`--explain` 的输入）时的兜底，
 * 所以取两边的**并集**：`.test.` / `.spec.` **或** 落在 `__tests__/` 目录里。
 */
export const isTestPath = (rel: string): boolean =>
  /\.(test|spec)\./.test(rel) || rel.includes('__tests__/')
