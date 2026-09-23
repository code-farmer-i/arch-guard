/**
 * S07 违规样例：`shared` 是**线性层序**，只许向层号 ≤ 自己的层 import。
 * `shared/lib` 是第 1 层，这里却依赖第 4 层的 `shared/api` —— 反向依赖。
 *
 * 同时它是孤儿文件 → S15。
 */
import { a } from '@/shared/api/a'

export function format(value: number): string {
  return String(value + a)
}
