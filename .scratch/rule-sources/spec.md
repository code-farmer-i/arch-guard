# 源码形态与规则来源：`packs` 退场

Status: done

## 场景（对应 REQUIREMENTS.md 的 R-143）

- **宿主想加自己的规则**（`dsh-workbench` 的 5 条套件边界规则 S60–S64）时：
  **现在**只能二选一 —— ① 自造一个包：`definePack({ id:'own', framework:'react',
rules:[...reactPack.rules, ...own], adapters: reactPack.adapters })`（必须**自称实现某个元框架**、
  必须**手工转发 adapters**，否则 `config.ts` 的 fail-closed 报"包不支持这个 facet"）；
  ② 走 `runGuard({ rules: [...] })` 程序化入口 —— 而 **CLI 从此看不见这些规则**
  （`--explain` / `--list-rules` / `--stats` / `--render-docs` 全盲）。写 `packs: [reactPack, ownRules]`
  会被 `packs.length > 1` 直接抛掉。
- **宿主忘了写 `packs`** 时：靠 **CLI 的 `fallbackPacks: [reactPack]` 补丁**才能跑；
  程序化调用方没有这个补丁 → 直接"没有任何可跑的规则"。
- **源码形态写在哪**：`Pack.framework` / `overrides.metaFramework` 两处被读且要互校；
  `Preset.metaFramework` 是**死声明**（`mergePresets` 搬运、`config.ts` 不读、
  没有任何预设声明过它、没有测试覆盖）—— 机械比对"merge 写出 16 个字段 / config 读入 15 个"才发现。
- **`packs` 数组形状本身诱导误用**：宿主看到数组就写两个 → 撞抛错 → 绕道程序化入口 → 于是有了上面第 1 条。

## 背景与问题

见 [`docs/adr/0009`](../../docs/adr/0009-source-form-is-a-scalar.md)（决策与理由的唯一出处）。要点：

1. `packs` 传的信息量 = 一个枚举值（两个包 `rules`/`adapters` 完全相同，只差 `id`/`framework`）；
2. 源码形态是**三处可写**（其中一处是死声明），而"能不能跑"取决于宿主有没有手递对象；
3. `data/framework-sources.ts`（层 1，纯数据）与 `coreRules`（层 4，代码）**不能合成一张表** ——
   反向依赖会被 S21 / 狗粮抓。

## 目标

- 顶层 `sourceForm: string`（标量）取代 `packs`；缺省 = 数据表里第一个已实现形态。
- 注册表按层拆：`data/framework-sources.ts` 只留 `{ id, extensions }`；
  `packs/registry.ts` 提供 `{ id, rules, adapters }` 绑定，**由调用方注入**（取代 `fallbackPacks`）。
- `overrides.customRules` 追加；`loadConfig` 解析期合并成 `Config.rules`。
- 形态只在一处：删 `Pack.framework` / `overrides.metaFramework` / `Preset.metaFramework` / 互校校验。
- `Pack` / `definePack` 降为内部；`implemented` 改派生；`RunOptions.rules` → `ruleSet`；
  `CONFIG_SPEC_VERSION` `'1'` → `'2'`。

## 非目标

- **不动能力模型**：`rule.requires` 仍是字符串根（`i18n.resourceDir` / `designSystem.styleDir`），
  自定义规则仍受限于已登记的能力根 —— 那是独立的一条债。
- **不做插件 / 包依赖 / 包顺序**系统：`Pack` 降内部后连入口都没有，也不需要有。
- **不推平 `overrides` 层**：保留（"项目优先"这条轴 + 配置里可读"哪些是项目自己的决定"）。
- **不改 `Pack` 的三段形状**：Vue pack 落地时它才需要长（今天两个 pack 只差标签）。

## 验收标准

- 单测：
  - `sourceForm` 三态：已实现 / 未实现（fail-closed，文案给迁移行）/ 省略（= 首个已实现形态）；
  - `customRules`：追加生效 · 同 id 同 title **幂等** · 同 id 不同 title **配置期报错**；
  - `Config.rules` = 内置集 + 追加（顺序稳定），且 `--explain <id>` / `--list-rules` 能看到追加的规则；
  - R-142 账目对追加的规则成立（`enable` / `disable` / `not-enabled` 一视同仁）；
  - `specVersion: '1'` 被拒，文案给出 `'2'` 与迁移提示；
  - **元守卫**：`mergePresets` 写出的字段集合 vs `config.ts` 读入的字段集合，差集非空即红
    （就是它发现了 `Preset.metaFramework`）。
- 夹具：`source-form`（三态）+ `custom-rules`（违规必报 × 合规不报：追加的规则真的在判）。
- 迁移：`arch.config.mjs` / 三个示例 / 所有用 `packs:` 的夹具 / 20 个测试文件 / 文档
  （DESIGN §7.5 · USAGE「加自己的规则」· PARADIGM §11 · ARCHITECTURE · ALTERNATIVES · ECOSYSTEM-AUDIT）。
- `pnpm check` EXIT=0（Node 24.13.0）；发版前补跑 Node 22.18.0；`--verify-deps` 对账通过。

## 边界与取舍

| 取舍                 | 决定                                                                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `customRules` 放哪层 | `overrides`（与 `aliases` / `adviceAllow` 同类：预设给不了、只有项目能声明）；顶层保留给"装配"（`specVersion` / `sourceForm` / `presets`） |
| 注入的绑定叫什么     | `loadConfig({ sourceForms })`（取代 `fallbackPacks`）—— 名字说清它是"引擎自带实现的注入点"，不是宿主的配置                                 |
| 缺省形态             | 数据表里**第一个已实现**的（今天 `typescript`）——与既有 `defaultFramework` 同口径，不新造规则                                              |
| 第三个框架怎么加     | 在 `data/framework-sources.ts` 加一行数据 + 在 `packs/registry.ts` 加一份绑定（Vue 落地时再加 parser/角色表变体）                          |
| 旧的 `packs:` 配置   | 配置期报错并给可粘贴的迁移行（`packs: [reactPack]` → `sourceForm: 'react'`），不做静默兼容                                                 |

## Comments

- 2026-09-27：设计经过三轮修正 —— ① 最初想"放开 `packs.length > 1`"；② 改成"`framework` 缺省的纯规则集包"；
  ③ 最终结论是**取消 `packs` 配置项**（源码形态是标量 + 规则是追加），因为数组只是症状，
  病根是"一个字段捆了三件事"+"源码形态三处可写（含一处死声明）"。
- 2026-09-27：`overrides` 是否推平也讨论过 —— **保留**（它提供优先级轴与来源可读性）；
  层与合并语义的明文归类（预设之间 vs 项目层是两套语义）另立一条需求。
- 2026-09-27 **落地**：`sourceForm` 标量 + `overrides.customRules` 追加 + 注册表按层拆
  （`data/framework-sources.ts` 纯数据、`packs/registry.ts` 绑定由调用方注入）；
  `Pack` / `definePack` / `tsPack` / `reactPack` 从公共 API 退场，`implemented` 改派生；
  `CONFIG_SPEC_VERSION` `'1'` → `'2'`；`Config.rules` 在解析期算定。
  夹具 `custom-rules`（追加的规则真的在判）+ `tests/source-form.test.mjs` 6 例 +
  **元守卫**（`mergePresets` 写出 vs `config.ts` 读入，两个方向都不许有差集）。
  **落地时暴露的两处**：① `Preset.metaFramework` 是死声明（merge 搬运、config 从不读）；
  ② `http` 面（R-138）漏在框架包的适配面白名单里 —— 同时声明 `packs` + `http(axiosKit())` 在 0.8/0.9 会被拒，
  属真 bug，本版一并修掉。
