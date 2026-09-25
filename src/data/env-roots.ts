/**
 * **要收集的"读取根"**（纯数据）。
 *
 * 事实模型会把以这些根开头的成员访问链记进 `facts.reads`（`import.meta.env.VITE_X` / `process.env.X`），
 * 供"读取落点"这类规则判定。放在数据表里，引擎里不出现平台字面量（P2/P4 的要求）。
 *
 * 为什么只收这几个根而不是"所有成员访问"：全收会让 facts 体积翻倍（每个 `foo.bar` 都进），
 * 而真正需要"落点纪律"的就是**环境相关的读取**（环境变量、构建期开关）——
 * 项目要管别的（`localStorage` 等）走 `callSites` 那条路。
 */
export const ENV_READ_ROOTS: string[] = ['import.meta.env', 'process.env']
