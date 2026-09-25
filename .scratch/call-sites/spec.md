# 调用落点（副作用：埋点/上报与本地存储 · 配置对象：QueryClient / createTheme）

Status: done

## 场景（写不出这一节的需求先不做）

- **上生产时**：`gtag()` / `Sentry.captureException()` 直接写在页面和 hook 里 ——
  "用户没同意隐私协议就别上报"这条判断没地方统一，审计时说不清数据从哪流出去。
  **现在：不报（已补）**。
- **要给 token 加密 / 加存储版本迁移时**：`localStorage.getItem('token')` 散在组件、hook、api 里 ——
  全仓找，漏一处就是半加密状态。**现在：不报（已补）**。
- **换埋点 SDK 时**：调用点散在各域，改一遍要动十几个文件。**现在：不报（已补）**。

## 目标

- 声明"哪些调用算副作用 + 只许出现在哪"之后，落点外的调用一律报。
- 测试文件豁免（mock storage / 断言埋点是正常用法）。
- 配了预设却什么都不声明 → **当场报错**，不留下"看起来配了"的静默停用。

## 非目标

- 不判"这次上报该不该带这个字段"（隐私判断是 L5，工具只保证"上报只有一处"）。
- 不管 SSR / 库的公开面 / monorepo（前端应用范围）。
- 不内置任何 SDK 名单（`gtag` / `Sentry` 是项目决定 —— 同 `deps({ allow })` 由项目给）。

## 验收标准

- `--self-test` 54/54：`side-effects` 夹具里页面内 `localStorage.getItem` + `gtag` 与 hook 里
  `Sentry.captureException` 各一条；两处封装（`shared/lib/storage.ts` / `analytics.ts`）与
  `*.test.ts` 零命中。
- `tests/structure-call-sites.test.mjs`：S38 分支（前缀匹配 / 落点内 / 测试豁免 / 未声明不判）+
  预设 fail-closed（`apis` 或 `in` 为空抛错）全绿。
- 双 Node `pnpm check` EXIT=0；规则 74 → 75，DESIGN / README / CHANGELOG / CONTEXT 同步。

## 边界与取舍

- **只认调用名**：`window.localStorage`（经 `window.` 拿到）与别名（`const ls = localStorage`）
  抓不到 —— 前者要再加一层"成员链归一化"，后者做不到（需数据流分析）。声明清单是项目责任。
- **不是"值级"检查**：不判存了什么、上报了什么（那是隐私评审的事）。
- **被否方案**：把 `localStorage` 等内置对象做成**默认** API 清单（不声明也判）——
  各项目对"副作用"的定义不同（有人还算了 cookie、IndexedDB、WebSocket），
  猜出来的清单会把正常写法报红；与"没声明就明列停用"的纪律也相反。

## Comments

- 2026-09-24 需求仍按「场景 → 决定做不做 → 才谈判据」走。这一轮是我从剩余场景里选的：
  它一次盖住"埋点/上报乱用"与"本地存储散落"两条，且与刚做完的 S36（取数落点）同族 ——
  共用"调用名匹配 + glob 落点 + 测试豁免"的骨架，边际成本最低。
  剩余候选（状态纪律 / 权限散落 / 路由守卫 / 上帝域 / 组合根 / legacy 单向性）没选，不是不重要。

## 第二轮：收口 + 组合根（同一批未发布，直接改）

上一轮把"副作用"做成了独立面 `side-effects`。这一轮要加"配置对象实例化"（域里 `new QueryClient()` →
两个缓存实例）时发现：**面的形状完全一样**（`name` / `apis` / `in`），再开一个面就是
"同一个事实的第二处"。于是收口：

- 面 `side-effects` → **`call-sites`**，适配器字段从 `apis`/`in` 变成 `groups: [{ name, apis, in }]`
- 预设 `sideEffects({ apis, in })` → **`callSites([{ name, apis, in }])`**（一组一类；组名进报告）
- 规则 S38 标题从「副作用只在声明的落点」改成「**调用只在声明的落点**」，遍历所有组
- 夹具 `side-effects` → **`call-sites`**：两组（副作用 + 配置对象）同一个夹具，各含正反
- 校验全在**预设**里做（`defineAdapter` 保持通用，不认宿主形状）：空组 / 空 name / 空 apis / 空 in /
  组名重复一律抛错

场景上新增的正是**组合根**：`src/app/main.tsx` 与 `src/shared/theme/theme.ts` 建配置对象合规，
`src/modules/crews/lib/queryClient.ts` 里 `new QueryClient()` 报。

## Comments

- 2026-09-24 收口说明：未发布前的同类改写直接做（不留两个面 / 两个入口）。如果这批判已发布，
  正确做法是保留 `sideEffects()` 作兼容壳 —— 记录在此，供以后判断。
