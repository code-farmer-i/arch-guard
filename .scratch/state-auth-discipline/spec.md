# 状态纪律 · 权限判断 · 跳转守卫（一族的"形态 + 落点"规则）

Status: in-progress

## 场景（对应 REQUIREMENTS.md 的 R-45 / R-46 / R-47）

**R-45 状态纪律不统一**

- `stores/crews.ts` 导出 `useCrewsStore`，另一个域把 `useOrdersStore` 写在 `hooks/` 里，
  第三个页面干脆 `useState + Context` 自己管 —— 新人不知道状态该写在哪。
- **现在：不报。**

**R-46 权限判断散落**

- `role === 'admin'`、`permissions.includes('crews.edit')`、`user.hasRole('editor')` 散在 12 个组件里；
  权限模型改一次要全仓找，漏改那处就是越权入口。
- **现在：不报。**

**R-47 跳转守卫重复写**

- "未登录跳登录"三个页面各写一遍：`useEffect(() => { if (!token) navigate('/login') })`、
  `<Navigate to="/login" />`，写法还不一致。
- **现在：不报。**

## 目标（三条同一套形状：**声明的形态** 只许出现在 **声明的落点**）

| 需求 | 声明                                                          | 判什么                                                          |
| ---- | ------------------------------------------------------------- | --------------------------------------------------------------- |
| R-45 | `structure.clientState: [{ naming: 'use*Store', in: [...] }]` | 导出名命中 `naming` 的文件必须在 `in` 里（S41）                 |
| R-46 | `callSites([{ name: '权限判断', apis: [...], in: [...] }])`   | **原始权限形态**只许在声明的落点（复用 S38，不新立规则）        |
| R-47 | `structure.authRedirects: { loginPaths: [...], in: [...] }`   | 字符串实参/JSX `to` 命中登录路径的**跳转**只许在守卫落点（S42） |

## 拍板（"需定口味"的那三句话，我定了 —— 理由在下）

1. **什么算"一套 store"** → **按命名 + 落点**：`use*Store` 这个**导出名形态** + 项目声明的落点。
   **不按 import 的库**（那会把库名写进引擎，违反 P4）。
2. **哪些算"合法的展示判断"** → **高层 API（`can('x')`）到哪都合法**；
   只有**原始权限形态**（`permissions.includes` / `user.hasRole` …）受落点约束 ——
   而"哪些是原始形态"由项目列，不是我们猜。
3. **怎么算"重复"** → **不数重复次数**（"同一段逻辑出现 ≥2 次"要语义比对，必然误伤），
   而是**按动作落点**判：**"跳到登录页"这个动作**只许出现在声明的守卫落点。

## 非目标

- 不判"这段状态该不该用 useState"（L5，无法区分 UI 局部状态与领域状态）。
- 不判权限文案差异（`role === 'admin' ? '管理员' : '成员'` 这类纯展示不在约束里，项目别把
  `user.role` 列进 `apis` 即可）。
- 不做守卫的**语义**检查（有没有正确处理过期 token、要不要记住 returnUrl 等）。

## 验收标准

- 夹具（各一对正反）：
  - `state-units`：`modules/crews/stores/useCrewsStore.ts` 不报；`modules/crews/hooks/useOrdersStore.ts` 报。
  - `permission-checks`：`shared/auth/permissions.ts` 里的 `permissions.includes(...)` 不报；
    页面里的 `permissions.includes('crews.edit')` 报；同一页面里的 `can('crews.edit')` **不报**（高层 API 合法）。
  - `auth-redirects`：`app/guards/RequireAuth.tsx` 里的 `navigate('/login')` 与 `<Navigate to="/login" />` 不报；
    页面里的这两种形态各报一条。
- 单测：未声明 → 不报；`naming` glob 匹配（`use*Store` 命中 / `useStore` 也命中 / `createStore` 不命中）；
  跳转按**字符串实参**与 **JSX `to`** 两侧判；登录路径之外（`/logout`）不报。
- 双 Node `pnpm check` EXIT=0；DESIGN §5.1 有 S41 / S42 行、规则数与夹具数口径同步。

## 边界与取舍

- **三条都只判"定义/动作落在哪"，不判"内容对不对"** —— 这是能保证零误伤的唯一切法。
- **R-45 只单向判**（命名必须在落点里）：反向"落点里必须只有 store"不判，因为 `stores/index.ts`
  这种聚合文件会把正常项目报红。
- **R-46 复用 S38**：同一族场景用同一套声明（`apis` + `in`），不为它另立规则 —— 少一条规则、
  少一处判定语义；代价是"原始形态清单"要项目自己写（我们猜谁都会误伤）。
- **R-47 只认"跳到登录页"**：不判"这段守卫逻辑重复了几遍"（语义比对做不到零误伤）。
- **被否方案**：
  - 按文件名/目录名判"这是不是 store"（`stores/` 里放非 store 的东西很常见）；
  - 按 AST 比较两个守卫块是否相似（误伤 + 无法解释）；
  - 把权限判断做成"字段访问必须走 API"（需要成员读取事实，现在没有，且会绑死权限模型形状）。

## Comments

- 2026-09-25 用户选中 R-45 / R-46 / R-47（三条原本都是"需定口味"）。三条的拍板由我给出并记录在上面 ——
  共同原则：**能判"落在哪"，就不判"写得好不好"**；形态清单一律由项目提供，引擎不猜。
