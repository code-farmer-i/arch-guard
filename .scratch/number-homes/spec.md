# 策略 / 阈值数字必须有家（D20）

Status: done

## 场景（对应 REQUIREMENTS.md 的 R-84）

- `staleTime: 300_000` 写在三个 hooks 里、`PAGE_SIZE = 20` 写在两个页面里；要统一改成 5 分钟 / 50 条时，全仓搜。
  现在：**不会报**（D19 未实现时，D 域对"数字在哪"完全没有判据；S38 只管调用落在哪）。
- 改一处漏一处 = 线上行为不一致，而门禁显示"通过"。

## 目标

- `designSystem({ numberHomes: [{ name, names, in }] })` 声明后（**声明才判**）：
  - 给 `names` 里的名字（对象属性名 `staleTime` 或常量名 `PAGE_SIZE`）赋**数字字面量**，
    而文件不在该组的 `in` glob 里 → error；
  - 落在声明的家（如 `src/shared/config/constants.ts`）里不报。

## 验收标准

- 新增事实 `numbers`（`{ value, raw, name, line }`）：只收**有名字**的数字字面量
  （最近的对象属性名 / `const` 名）；没有名字的裸数字不收（那是一堆噪音，且判不了"该有家"）。
- 夹具 `number-homes`：`staleTime` 写在页面里报；同一份数字写在声明的家、以及不在 `names` 里的名字不报。
- 事实模型版本 `FACTS_CACHE_SPEC` 5 → **6**（`styleProps` / `numbers` 两组新字段）。
- 双 Node `pnpm check` EXIT=0。

## 边界与取舍

- **按名字判，不猜语义**："这个数字算不算业务阈值"是 L5；项目把自己关心的名字列出来才判。
- **只收数字字面量**：`pageSize: PAGE_SIZE`（引用常量）不报 —— 引用正是它该有的样子。
- **不做数值范围/类型校验**：那是 schema 的活（zod 之类），不是目录契约。
