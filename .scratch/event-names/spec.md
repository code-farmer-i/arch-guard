# 埋点事件名只有一个出处（M2 / D24）

Status: done

## 场景（对应 REQUIREMENTS.md 的 R-78）

- `track('crews_view')` 的事件名在各处手拼：改名漏一处就是**数据断层**，而分析平台不会报错
  （它只会安静地少收一个事件）。与缓存键（D22）、路由路径（D23）是同一族问题。
- **修前：不报。**

## 目标

- `analytics({ apis: ['track'], eventSource: 'src/shared/lib/analytics/events.ts' })` 声明后：
  把**事件名字符串直接传给声明的埋点调用**就报；传常量（`track(EVENTS.crewsView)`）不报；
  事件表文件本身不判。

## 验收标准

- 夹具 `event-names`：页面里 `track('crews_view')` 报；`track(EVENTS.crewsView)` 与事件表文件不报。
- 未声明 `analytics()` 时 D24 由 `requires` 明列停用（不是静默通过）。
- 双 Node `pnpm check` EXIT=0；DESIGN §5.3 有 D24 行。

## 边界与取舍

- **只看第一个字符串实参**：`gtag('event', 'crews_view')` 这种多参数 API 抓不到（facts 只记第一个）——
  项目要么包一层单参数 wrapper 再声明，要么别把它列进 `apis`。**清单是项目责任**（声明了才判）。
- **不做"事件名必须登记在平台"**：那要联网 / 要平台 API，不在本工具范围。
- **与 S38（调用落点）的分工**：S38 管"这类调用只许在哪调"，D24 管"这类字面量只许在哪写" ——
  两条可以同时声明（落点 + 唯一出处），互不代理。

## Comments

- 2026-09-25 挖掘需求时选中（"唯一出处"族的第三处）。
