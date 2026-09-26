/**
 * 官方 **`@x` 跨引用公开面**（R-105）：crew 声明"允许 order 拿这些"。
 *
 * 切片之间默认不许互引（S22），官方给的唯一出口就是它，而且**只放行被指名的那一侧**：
 * `entities/order` 从 `entities/crew/@x/order` 进是合规的，`entities/` 里别的切片引同一个文件会报。
 * 绝大多数时候它只传**类型**（官方示例也是 `export type`）—— 数据仍然各归各的实体。
 */
export type { Crew } from '../model/types'
