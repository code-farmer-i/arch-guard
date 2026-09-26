/**
 * 这个域的**业务公开面**（R-98）：别域要用的实体/工具从这里出去。
 *
 * 为什么要它：没有业务公开面时，跨域协作只有两条路 —— 直捣对方内部（S04/S05/S23 会报），
 * 或者把东西抬进 `shared/`。抬得越多，`shared` 越像"第二套 modules"，域边界就成了装饰。
 * 有了它，跨域协作是**一条合法通道**：`import { … } from '@/modules/crews'`。
 */
export { formatCrewName } from './lib/format'
export type { CrewRow } from './model/types'
