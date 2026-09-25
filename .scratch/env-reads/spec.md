# 环境变量 / 开关读取落点（M3 / S44）

Status: done

## 场景（对应 REQUIREMENTS.md 的 R-79）

- `import.meta.env.VITE_API_BASE` 在十几个文件里直接读：改名 / 换环境全仓搜；
  而且读到的是**原始字符串** —— 没有默认值、没有校验、没有类型。
- **修前：不报**（facts 里根本没有成员访问事实）。

## 目标

- `envReads({ apis: ['import.meta.env', 'process.env'], in: ['src/shared/config/**'] })` 声明后：
  落点外的这些读取报；配置模块里读不报。
- 事实侧新增 `reads`（环境相关的成员访问链），根名单放数据表 `src/data/env-roots.ts`。

## 验收标准

- 夹具 `env-reads`：`modules/crews/lib/api.ts` 里读 `import.meta.env.VITE_API_BASE` 报；
  `shared/config/env.ts` 里读不报。
- 单测：落点内 / 测试文件 / 未声明都不判。
- 双 Node `pnpm check` EXIT=0；DESIGN §5.1 有 S44 行、§7.2 面表有 `env-reads`。

## 边界与取舍

- **只收"环境相关"的读取根**（`import.meta.env` / `process.env`，数据表可扩）：全收所有成员访问会让
  facts 体积翻倍（每个 `foo.bar` 都进），而真正需要落点纪律的就是环境读取。
- **只看最外层链**：`process.env.A.B` 记整条（`process.env.A` 那次不再单记）。
- **不做"必须有默认值 / 校验"**：那是配置模块自己的写法（L5），落点纪律只保证"只有一处读"。
- **与 `callSites` 的分工**：那条管**调用**，这条管**读取** —— 两条可以同时声明，互不代理。

## Comments

- 2026-09-25 挖掘需求时选中（M 批最后一条）。
