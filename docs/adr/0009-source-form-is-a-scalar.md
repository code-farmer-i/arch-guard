# ADR-0009 源码形态是标量，规则是追加：`packs` 退场

- **状态**：已采纳（2026-09-27）—— **修正** DESIGN §7.5 里"宿主用 `packs: [xxxPack]` 挑框架包"的口径
- **关联**：R-143 · R-142（规则账目）· ADR-0006（原语是词汇）· `docs/DESIGN.md` §7.5

## 背景

`packs?: Pack[]` 与 `if (packs.length > 1) throw` 是**同一个提交**引进的（`b5c4957`）——
不存在"早期支持多个、后来收紧"的历史：它从诞生起就是**列表里的一个**，类型能表达运行期不允许的状态。

实测（2026-09-27）：

1. **两个包只差一个标签**：`tsPack` 与 `reactPack` 的 `rules` 是同一份 `coreRules`、
   `adapters` 是同一张 12 项的清单，只有 `id` / `framework` 不同 →
   `packs` 传给引擎的信息量 = **一个枚举值**。
2. **源码形态今天有三处可写**：
   - `Pack.framework`（被读）；
   - `overrides.metaFramework`（被读，且与 `pack.framework` 互校 —— 第二处真相必须对账）；
   - `Preset.metaFramework` —— **死声明**：`mergePresets` 把它搬进 `out.metaFramework`（`util.ts`），
     而 `config.ts` 只读 `overrides.metaFramework ?? pack?.framework ?? default`，
     **没有任何预设声明过它、没有任何测试覆盖它**。机械比对"merge 写出 16 个字段 / config 读入 15 个"
     才发现的（差集只有它）。
3. **"能不能跑"取决于宿主有没有手递那个对象**：`data/framework-sources.ts` 的 `implemented`
   说"本工具有 react 的包"，但规则集实际由宿主配置里那个对象带来。省略 `packs` 时靠
   **CLI 的 `fallbackPacks: [reactPack]` 打补丁**（注释原话："忘了写 `packs` 的 React 宿主靠它继续可用"）；
   程序化调用方没有这个补丁 → 直接"没有任何可跑的规则"。
4. **宿主想加自己的规则**只能：① 自造包（必须自称实现某个元框架 + 手工转发 `adapters`，
   否则 `config.ts` 的 fail-closed 会报"包不支持这个 facet"）；或 ② 走 `RunOptions.rules` ——
   而 CLI 从此**看不见**这些规则（`--explain` / `--list-rules` / `--stats` 全盲）。

## 决策

1. **源码形态是一个标量事实**：顶层 `sourceForm: string`（缺省 = 数据表里第一个已实现形态）。
   `Pack` 不再出现在宿主配置里。
2. **注册表按层拆**（不能合成一张表）：
   - `src/data/framework-sources.ts`（层 1）：只留**纯数据** `{ id, extensions }` ——
     数据层不许引用 `coreRules`（那是层 4 的代码），否则就是反向依赖（S21 / 狗粮会红）；
   - `src/packs/registry.ts`（层 4）：`{ id, rules, adapters }` 的**实现绑定**；
   - 绑定**由调用方注入**给 `loadConfig`（取代 `fallbackPacks`），缺省由 CLI 传内置绑定。
3. **`Pack` / `definePack` 降为内部**：它们是"框架实现"的实现细节（DESIGN §7.5 说 pack 是随引擎
   分发、经评审、带 fixtures 的代码 —— 宿主本来就不该持有这个概念）。删 `Pack.framework`
   （形态由 `sourceForm` 选、绑定按 id 匹配），`definePack` 只保留 id / 规则非空 / 规则冲突校验。
4. **`implemented` 删除**：它是个派生量（该形态有没有绑定），手写就成了第二处真相。
5. **删 `overrides.metaFramework`、`Preset.metaFramework` 与互校校验**：形态只在一处。
6. **规则是追加通道**：`overrides.customRules: Rule[]`（与 `aliases` / `adviceAllow` 同层：
   都是"预设给不了、只有项目能声明"的键），在 `loadConfig` **解析期**合并出 `Config.rules`
   （同 id + 同 title → 幂等；同 id + 不同 title → 配置期报错）。它**进 R-142 的账目**
   （`enable` / `disable` / `not-enabled` 一视同仁）——新的规则来源不许重新开一个静默入口。
7. **`RunOptions.rules` → `ruleSet`**：语义是**完整替换**（工具集成 / 测试 / 兜底），
   与配置里的"追加"在名字上分开。
8. **`CONFIG_SPEC_VERSION`: `'1'` → `'2'`**：这是配置格式的破坏性变更，正是这个字段存在的目的；
   宿主写 `specVersion: '1'` 会在配置期拿到明确报错（不是静默）。

## 后果

- **好处**：非法状态不可表达（标量取代"数组里的一个"）；形态只剩一处真相；
  宿主不再需要接触 `Pack`（不必自称实现某框架、不必转发 `adapters`）；
  规则来源唯一（内置集 + 追加），且 CLI 与 runner 读**同一份** `config.rules`
  （今天 `run.ts` 与 CLI 各推一遍）；`fallbackPacks` 与它那条补丁一起消失
  （"不写也能跑"由"缺省 = 第一个已实现形态"承接，不再依赖调用方）。
- **代价**：破坏性配置变更（迁移表见 spec）；`Pack` 的公共 API 面收窄
  （第三方框架包本来就不受支持 —— §7.5 说它随引擎分发，这条只是把实情写明）。
- **明确不做**：不动能力模型（`requires` 仍是字符串根 + `PATTERN_FIELDS`）；
  不做插件 / 包依赖 / 包顺序系统；**保留 `overrides` 层**（它提供"项目优先"这条轴，
  且让"哪些是项目自己的决定"在配置里可读）—— 层与合并语义的明文归类是**另一条需求**。
