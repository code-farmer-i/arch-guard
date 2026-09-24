/** S08 样例：与 `b.ts` 互相 import，构成依赖环 —— 环让「依赖单向」失效。 */
import { b } from './b'

export const a = b + 1
import { Card } from '@/shared/components/common/Card'
export const usesCard = String(Card)
