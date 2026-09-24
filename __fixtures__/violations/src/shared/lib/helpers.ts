/**
 * 违规夹具：一个文件同时命中三条规则，且不被任何入口引用。
 *
 * - S11 barrel 再导出（`export *` 把真实依赖藏起来）
 * - S13 lib 槽位禁止 default 导出
 * - S15 孤儿文件（合成夹具里没有入口引用它）
 * - S33 悬空说明符（`./helpers.internal` 不存在）—— **故意留的**，别"顺手修好"：
 *   barrel 把真实依赖藏起来时，指向不存在的文件在图上就是无边
 *
 * 曾因 `.gitignore` 的裸 `lib/` 规则被吞掉而从未进过 git —— 干净克隆下门禁必红。
 */
export * from './helpers.internal'

export default function helpers(): void {}
