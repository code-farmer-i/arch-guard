# Changelog

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 与语义化版本。

> **发布流程（从 0.4.0 起严格执行）**
>
> - 发布时把 `[Unreleased]` 按类型**切分成版本段落**（`## [x.y.z] - YYYY-MM-DD`），不要留在 `Unreleased` 里。
> - **契约变更必须单独标注**：JSON 报告动过 `apiVersion`、`NOTICE_CODES` / `SKIP_CODES`，
>   或退出码语义有变 → 在该版本段落里写明「破坏性」与迁移方式（参照 `[0.3.5]` 那节的写法）。
> - **0.3.0–0.3.3 的章节是按 git 标签区间事后回填的**（此前全堆在 `[Unreleased]` 里，版本无从回溯）；
>   回填只搬位置、不改内容，归属依据是「该小节首次出现在哪个标签区间」。
> - **0.3.4–0.3.8 也是同样办法回填的**：切 `[0.4.0]` 时发现这几节其实早已随那些标签发布，只是堆在
>   `[Unreleased]` 里（归属按 `git tag --contains <引入该节的提交>` 判定）。
> - 理由：**0.3.0 / 0.3.1 / 0.3.2 没有独立章节**（内容都还堆在 `[Unreleased]` 里，事后无从回溯哪个版本动了什么）。
>   那次恰好一口气给 JSON 加了五个字段而无人可察 —— 消费方只能靠猜。版本记录是契约变更唯一的审计落点，
>   没有它，`apiVersion` 也只是一句口号。

## [Unreleased]

### Changed（需求口径：撤掉两条）

- **撤掉 R-70「抑制注释报出」**（`eslint-disable` / `@ts-ignore`）：`@ts-ignore` 那一半靠 TS 的严格开关与
  review 兜；专门做一条"禁止 suppression"会与"规则级例外必须写理由"重复表达同一件事。
- **撤掉 R-30「复杂度 / 嵌套深度 / 参数个数」**：交给宿主自己的 eslint（`complexity` / `max-depth` /
  `max-params`）—— 它本来就只是"把三条 eslint 规则写进委派清单"，不如直接写进宿主配置。
- 编号**不复用、不重排**：两个编号登记在 REQUIREMENTS 第七节（写成「原 R-30」/「原 R-70」），
  正文不再出现；`tests/process.test.mjs` 新增校验"缺的编号必须被声明为已撤"，否则算漏号。

### Added（状态纪律 · 权限判断 · 跳转守卫 —— 同一套"形态 + 落点"）

三条原本都属"需定口味"，拍板原则：**能判"落在哪"，就不判"写得好不好"**；形态清单一律由项目提供。

- **R-45 状态纪律（S41）**：`stores/crews.ts` 导出 `useCrewsStore` 合规，另一个域把 `useOrdersStore`
  写在 `hooks/` 里就报（`structure.clientState: [{ naming: 'use*Store', in: [...] }]`）。
  **按命名 + 落点判，不按 import 的库**（那会把库名写进引擎）。只单向判：落点里放别的不管。
- **R-46 权限判断（复用 S38，不新立规则）**：把**原始权限形态**列进 `callSites([{ name: '权限判断',
apis: ['permissions.includes'], in: ['src/shared/auth/**'] }])` —— 落点外报，而
  **高层 API（`can('x')`）不在清单里 → 到哪都合法**（这就是"哪些算合法展示判断"的答案）。
- **R-47 跳转守卫（S42）**：`navigate('/login')` 与 `<Navigate to="/login" />` 只许出现在
  `structure.authRedirects.in` 里。**不数"重复了几遍"**（语义比对必然误伤），只判这个动作落在哪。
- 规则 76 → **78**（S41 / S42，R-46 用现有能力表达）；夹具 56 → **59**。

### Added（指纹表可被项目覆盖 —— 收紧与放宽都行）

- **场景 ①：企业规范只认公司内部那套实现**，或项目把 `JSON.parse(JSON.stringify(x))` 收进
  `shared/lib/clone.ts` 当唯一深拷贝出口 —— 内置指纹表改不了，只能全仓改写法或干脆关掉 P06 / P07。
- **场景 ②：内部自研库其实很成熟**（`@org/utils` 里有 `formatDate`），却被"疑似自造轮子"提示，
  没法声明"这是我们认可的实现"。
- **现在支持**：`deps({ capabilities, fingerprints: [{ capability, addSyntax / removeSyntax /
addSoftSyntax / removeSoftSyntax / apiNames / allowOwn / platform / hint }] })` ——
  判定跟着**生效表**走（P06 / P07 都不再直接读内置表）。**首选方案仍只来自 `capabilities`**
  （一个事实一个出处）。能力名拼错、pattern 写不成正则 → **配置阶段直接报错**，不留"配了但不生效"。
- 夹具 `fingerprint-override`：项目删掉 JSON 深拷贝那条形态后 `clone.ts` 不再报，
  而手搓日期格式化照旧报。夹具 55 → **56**。

### Added（两条边界门禁：上帝域 · 迁移只出不进）

- **场景 ①：三个域都在 import `crews` 的组件** —— 改 `crews` 一个 props 得同时改三个域；
  S34 只看**单个文件**被几十处引用，看不见「整个域被一半的域依赖」。
  **现在拦住**：`structure.couplingLimits` 声明维度与上限（`maxFanIn` / `maxFanOut`）后，
  超过就报，点位落在**参与度最高的那个文件**上，报告点名"被哪些组依赖"。
- **场景 ②：`src/legacy/**` 待迁走，新代码却 `import { oldPrice } from '@/legacy/pricing'`** ——
  legacy 从"待清理"变成"事实核心"，迁移永远做不完。**现在拦住**：`structure.migrating`
  声明迁移中的路径后，外面引用它们即报；它们自己引用新代码不报（**只出不进**）。
- 两条都是**声明才判**：阈值与路径全在宿主手里，没声明就明列停用；测试角色（layer ≥ 90）不参与耦合计数。
- 规则 74 → **76**（S39 / S40）；夹具 53 → **55**（`coupling-limits` / `migration-boundary`）。

### Changed（**移除 S33 导入必须解析得到** —— 交回生态）

- **破坏性（对规则集）**：`S33` 不再存在。宿主若在 `enable` 里写了它，报告会提示
  「配置里启用了不存在的规则：S33」—— 删掉那一项即可。规则数 75 → **74**。
- 理由：`import/no-unresolved` 是更成熟的等价物，宿主本来就有 eslint；"路径写错"是编辑器与编译器就先喊的错，
  不值得占目录契约的一条红线。**引擎事实 `graph.unresolved` 保留**（依赖图要用它），
  受影响的门禁行为：解析不到的说明符仍然不会形成图上的边（所以图规则的语义不变）。
- 移除的东西：规则实现、`library()` 的 enable 项、专用夹具 `__fixtures__/unresolved/`、
  `violations` 夹具与 `guard` 测试里的期望；口径同步 DESIGN §4.9 / §5、ARCHITECTURE、REQUIREMENTS（R-04 → 不做）。

_（暂无：下一个版本的内容往这里加）_

## [0.4.0] - 2026-09-25

> **状态**：CHANGELOG 已切段；`package.json`（仍是 `0.3.8`）与 git tag 待发布时同步。

### Added（调用落点：副作用 · 配置对象 —— 一组一类地声明）

- **场景 ①：`gtag()` / `Sentry.captureException()` / `localStorage.getItem('token')` 散在各域** ——
  "没同意隐私协议就别上报"没地方统一、token 要加密时全仓找、换埋点 SDK 要翻遍页面。
- **场景 ②：某个域自己 `new QueryClient()` / `createTheme()`** —— 运行时两个缓存实例，
  `invalidateQueries` 莫名不生效、主题不统一，查一下午。
- **现在拦住**：`callSites([{ name, apis, in }])` 一组一类地声明"哪些调用 + 只许出现在哪"，
  落点外的调用一律报（对象方法按**前缀**匹配：`localStorage` 一条盖住 `getItem` / `setItem` / `clear`；
  `new QueryClient()` 按整名匹配；测试文件豁免）。真实输出见夹具 `call-sites`：
  页面里 `localStorage.getItem` / `gtag`、hook 里 `Sentry.captureException`、域里 `new QueryClient()`
  各一条；两处封装与 `src/app/**`、`src/shared/**` 零命中。
- **收口**：上一轮把"副作用"做成独立面，这一轮把面收成通用 `call-sites`（形状完全一样，
  两个面就是同一个事实的第二处）；`sideEffects({ apis, in })` → `callSites([{ name, apis, in }])`。
- 预设对每组做 **fail-closed 校验**：`name` / `apis` / `in` 任一为空、组名重复、一组都没有 → 当场报错
  （配了却什么都不判 = 静默失能）。
- 规则 **75 → 75**（S38 从"副作用"泛化成"调用"），夹具 `side-effects` → **`call-sites`**（两组同夹具）。

### Added（三个前端场景的门禁：页面里取数 / 页面被静态 import / 退路残留）

- **场景 ①：页面里直接 `useQuery`、域里直接 `fetch('/api/x')`** —— 换数据层要翻遍页面、
  契约类型散在各域、测试必须 mock 网络。
  **现在**：`dataLayer(reactQueryKit({ fetchIn: [...] }))` 声明取数落点后，**S36** 拦住落点外的取数调用
  （测试文件豁免；方法名按 `.` 后缀匹配，所以 `queryClient.invalidateQueries` 也抓得到；
  取数 API 名由 kit 按方案声明，`fetch` / 自家 hook 可以追加）。没声明落点 → 明列停用。
- **场景 ②：路由表静态 import 页面** —— 所有页面随主包下载，首屏跟着变大，第一个月没人发现。
  **现在**：`canonical({ lazyViews: true })` 声明后，**S37** 报"页面被入口静态 import"；
  组件之间互相引用不管（那不是首屏问题）。
- **场景 ③：重构后旧实现留在仓库里**（`CrewsPage.old.tsx` / `useCrewsLegacy.ts`）——
  没人敢删、新人抄了旧的那一份、两套实现行为不一致。
  **现在**：**H12** 判"整段命中"（子串不算、目录名不算，所以 `legacy-support.ts` 与
  `src/legacy/**` 迁移容器都不受牵连）；`hygiene()` 默认启用。
- 适配器新增两组字段：`data-layer` 的 `fetchApis`（kit 按方案声明）/ `fetchIn`（项目声明落点）；
  `reactQueryKit({ fetchIn, fetchApis })` 收参。规则 **71 → 74**，夹具 **50 → 53**，单测 +7 例。

### Added（字面量唯一出处：D22 缓存键 · D23 路由路径）

- **D22 缓存键只有一个出处**：`dataLayer(reactQueryKit({ queryKeyFrom: 'src/shared/api/queryKeys.ts' }))`
  声明键的落点后，`{ queryKey: ['crews', id] }` 这类**键字面量**只许出现在那个文件里（引用
  `keys.detail(id)` 合规）。判据来自 facts 的 `strings[].prop`。
- **D23 路由路径只有一个出处**：`router(reactRouterKit({ pathSource: 'src/shared/config/paths.ts' }))`
  声明路径落点后，`path` / `to` 属性与 `navigate()` / `router.push()` 这类跳转调用的**绝对路径字面量**
  只许出现在那个文件里；属性名与调用名由方案面声明（`pathProps` / `navigateCalls`）。
- 两条都是**声明落点才判**（`requires`）：没声明 → 报告里明列停用，不空转。落点写错（文件不存在）时
  **只报一条"落点不存在"**，不逐条把项目刷红。
- `engine/facts.ts` 的 `StringFact.prop` 现在会**透传**（数组 / 对象 / 括号 / 断言 / 展开 / 三元不改变
  "最近的属性名"，函数体与调用实参断开）—— 否则 `queryKey: ['crews']` 里的字面量永远拿不到属性名。
  这也是那个字段的第一个消费者；`FACTS_CACHE_SPEC` 1 → **2**（事实语义变了，旧缓存必须作废）。
- `facts` 的两组新读法对应两条新规则，落点字段进适配器白名单并有类型校验（空串 = 拼错了，直接报）。
- 夹具 **50 个**：新增 `route-paths`（路径字面量 × 引用对照）与 `cache-keys`（手拼键 × 引用键对照）；
  `tests/design-sources.test.mjs` 5 例（落点缺失 / 未声明 / 形态可配 / 引用与落点文件内不报）。
- 顺手改正 DESIGN §6.1.1 的事实模型示意（还写着 `jsxText` / `styleObjects` / `catches` / `tokens`
  这些委派后已删的字段，与实际 `Facts` 不符）。

### Added（一个面一个方案 + 生效的适配器可见）

- **报告自述 `adapters-in-use`**（`notices` 新 code，**兼容性新增**：不 bump `apiVersion`，
  未知 code 用 `isNoticeCode` 守卫可判；按 §6.9 的规矩在此单独标注）：每次运行报一行
  `生效的适配器：router=react-router · styles=css-modules` —— 适配器只写在配置里，
  报告以前完全不提它，"跑的是哪套 kit"只能去翻 `arch.config.mjs`。
- **`--verify-deps` 列出整张适配表**：`facet` / `id` / `specVersion` / 形态字段（`routeFiles`、
  `modulePatterns`、`resourceDir`…）/ 包对账；**没有 npm 包的 kit 也在表里**（CSS Module 就是这种方案），
  否则"我配了 `styles()` 吗、它认哪种文件"在排查时看不见。

### Fixed（两份 kit 声明同一个面时静默取后者）

- **`mergePresets` 对同一个面 fail-closed**：内容不同的两份适配器声明（`router(a)` + `router(b)`，
  或 `stack({ uiKit: antdKit() })` + 手写的 `uiKit(muiKit())`）以前是**浅合并静默取后者** ——
  换库换错、组合时手滑多写一份，现场都看不出来。现在直接报错并指出用 `overrides.adapters` 显式覆盖；
  内容**完全相同**的重复声明仍幂等（与 `defineFacet` 对同一个面的态度一致）。
- 顺手改正 DESIGN §6.9 一处口径：`NOTICE_CODES` 的家是 `engine/codes.ts`（不是 `types.ts`）。
- **`overrides.adapters` 不再绕开校验**：合并后的适配器全部再过一遍 `defineAdapter` ——
  字段白名单 / 类型 / 正则可编译 / `id` 必填 / **键与 `spec.facet` 一致** / **面已登记**。
  这条通道以前能让拼错的字段静默失能（`routeFile` vs `routeFiles`），也能让引擎完全不认识那个面
  （能力协商看不见、`--explain` 不提）。现在当场报错并给出可用字段：
  `[router] 未知字段：routeFile（允许：examples, facet, id, packages, routeFiles, specVersion）`。

### Added（方案面形态：规则不再写死 `routes.tsx` / `*.module.css`）

- **方案面声明「形态」（T1 第二半）**：适配表回答"用哪个库"之外，还要回答"规则判的写法长什么样"。
  - `router.routeFiles`：域的**公开面入口文件名**（默认 `['routes.ts','routes.tsx']`），
    **S03 / S04 / S05 / S14 / S15** 照它判（以前写死 `routes.tsx`）。
  - `styles.modulePatterns`：**组件样式文件形态**（正则，默认 `['\\.module\\.css$']`），
    **D16 / D17** 照它判（可换 `*.module.scss` 等；`cssModulesKit({ modulePatterns })` 必须自带
    hit / miss 样例，样例会拿真正则验证 —— 这是"正则写歪了却不生效"唯一能被抓住的地方）。
  - 默认值只有一处（`src/data/face-forms.ts`），规则经 `packs/core/rules/face-forms.ts` 读，并对外导出
    `DEFAULT_ROUTE_FILES` / `DEFAULT_MODULE_PATTERNS`（写自定义 kit 时别再抄一份）。
- **空清单是声明，不是"没配"**：`routeFiles: []`（文件路由：没有 per-domain 出口文件）/
  `modulePatterns: []`（Tailwind / CSS-in-JS：没有组件样式文件）→ 依赖它的规则**不判**，
  而不是拿默认形态去硬判。例外是 **S03**：真没有入口文件时**照报**（S01 已把域根让给它，
  放行就等于域根没有任何规则看着）。
- **自定义入口词汇由 kit 收参**：`reactRouterKit({ routeFiles })` / `noneRouterKit({ routeFiles })`
  （空清单也照原样声明，仍走 `defineAdapter` 校验 —— 不再需要往配置里塞裸适配器对象）。
- **位置类判定一律按词汇，不看角色 slot**：`S14` 的"有没有入口"、`S15②` 的"入口必被 app 聚合"
  以前读 `record.slot === 'routes'` —— 入口一改名就判不出来（假阳性 / 静默漏报）。现在按
  `routeFiles` + **扫描域里的真实文件**判（`presentFilesOf`：`ctx.records` 只装命中角色的文件，
  role-less 的入口落在 `scan.missing` 里，只看 records 会得出"域里没有入口"）。
- **词汇与角色表必须一起改，S03 会盯着（两个方向都判）**：
  - 名字在词汇里、却没命中任何角色 → `域入口 X 不在目录契约内：角色表里没有它的角色`
    （因为没角色的文件不进解析，图规则看不到它的 import；与其让 S15③ / S04 / S05 各报一句误导的错，
    不如这里说清）。
  - 反过来，角色表里 `slot: 'routes'` 的文件不在词汇里（入口搬走后留下的 `routes.tsx`）→
    `… 被角色表当作域入口，但方案面声明的入口是 …：词汇与角色表不一致`。
- 夹具 **48 个**：新增 `route-vocabulary`（入口叫 `routes.ts` 的域不再被 S04 / S05 误报）、
  `module-pattern`（`.module.scss` 被 D16 / D17 认作组件样式，`globals.css` 照报）、
  `route-custom-vocabulary`（kit + 角色表一起改，零发现项）与
  `route-custom-vocabulary-gap`（只改 kit：S03 报角色缺口）。

### Fixed（入口叫 `routes.ts` 的域被误报）

- **S04 / S05 / S15③ 把 `routes.tsx` 写死在规则里**，而范式角色表写的是 `modules/{domain}/routes.{ts,tsx}` ——
  两边一漂，入口叫 `routes.ts` 的域会被误报「跨域引用了内部文件」（S04 / S05）、
  view 被报「没有被 routes 引用」（S15③）。现在词汇只从方案面读，与角色表对齐；
  S03 / S14 的文案与 `placementHint` 也照同一份词汇念（不再指着一个本方案不存在的文件名）。
- **S03 在"入口词汇为空"时的文案会被读成文件名**（`域根目录只许 本方案未声明任何入口文件，出现了 helpers.ts`）→
  改成 `域根不该有文件（本方案未声明入口文件），出现了 helpers.ts`；`placementHint` 同理不再把域入口
  算进槽位表（有入口时"七个槽位"的原文案不变）。这条是**跑演示场景时当场发现的**，见
  `.scratch/face-forms/demo-router-kit.sh` 场景 E。

### Added（依赖图收敛 + 声明驱动的组规则 + 方案适配器）

- **收回两个委派缺口**：**S08 依赖环**（`graph.cycles`）与 **S33 导入必须解析得到**（`graph.unresolved`）——
  后者此前零消费者，写错相对路径（少一层 `..`）会**静默通过**；上线当天就抓到三处真实问题
  （`structure-isolate` 夹具的坏路径已修；`violations` 的悬空说明符是故意的，写进注释；
  `graph` 夹具的 `shared/api` 环按 S08 样例补注释与期望）。
- **S34 文件级入/出度上限**（`structure.degreeLimits`）：组粒度看不见的"神模块 / 改一处动全身"。
- **声明驱动的组规则**：`S35` 组必须有片段（**编号说明**：`S24` 已是"契约扫描域不得为空"，故排在其后）·
  `S25` 片段内保留名目录 · `S26` 组数量上限 · `S27` 目录子项数上限 · `S28` 组的外部引用下限（死切片）·
  `S29` 组名撞单元 · `S30` 重复词 · `S31` 单复数一致 · `S32` 导入局部性（默认关）。
- **`structure` 声明扩到 13 个字段**：解析 / 加法合并 / `overrides` 显式覆盖 / fail-closed 校验
  （维度名与角色 id 不存在一律报错）落在 `engine/structure.ts`。
- **词形判定改用 `pluralize`**（新增运行时依赖，已按 P1 审查门登记三处）：手写表在 315 词语料上分歧 2.9%，
  含 `alias`/`atlas` 误报与 `apis` 漏报的真 bug；`src/data/plural-forms.ts` 只留薄封装 + 中性词政策层。
- **适配器面开放注册（E2）**：引擎只预注册有消费者的核心面，新面由预设 `defineFacet` 登记；
  `FACETS` 常量 → `facetNames()` / `facetSpec()` / `facetOfCapabilityRoot()`（公共 API 变更）。
- **方案适配器（T1 第一半）**：`router()` / `dataLayer()` / `styles()` 三个面 + kits，
  配 **P12 同类方案不许混入**（判据来自 `src/data/solution-alternatives.ts`）。
  适配器只声明 `packages`（P12/P04/P01 真正消费的字段）——不做"声明了没人读"的字段。
- **`fsd()` 与社区文件系统模型对齐**：单文件片段（`model.ts`）· 入口认代码扩展名 · shared 每个片段的入口
  （ui/lib 走一级子目录 + 根入口豁免）· 重名查组路径段 · shared 公开面单元（S23③）。
- 夹具 44 个（新增 cycles / unresolved / degree-limits / group-in-degree / import-locality / solutions /
  structure-groups / structure-limits / structure-name-collisions / structure-repetitive-naming /
  structure-plural-consistency / fsd-parity / fsd-boundaries / fsd-import-locality），
  全部 `exact`；规则总数 56 → **69**。

### Changed（文档口径）

- DESIGN §14 移除已实现的 E2 行；`--verify-deps` 只做本地对账。
- README / DESIGN / ALTERNATIVES / CONTEXT 同步新规则、新声明、方案面与「与 steiger 的规则对齐」表。
- **`REQUIREMENTS.md` 成为需求的唯一来源**：**72 条**按场景分组，每条 = 痛点（带具体例子）+
  预期行为 + 状态 + **由谁来做**（本体 / 可委派给 eslint · stylelint · knip · dependency-cruiser 等）；
  委派出去的检查**本身就是需求**（不再另开一份委派清单，权威清单仍在 DESIGN §4.9）。
  `AGENTS.md` / `docs/agents/scenario-first.md` / README Roadmap / spec 模板都已指向它。
- **「联网成熟度查询」这条整体删除**（用户要求不再列为待办或"不做"项）：README Roadmap 的待办、
  REQUIREMENTS 的 N-02、PARADIGM §12.5、DESIGN §16.4 都已去掉（DESIGN §16.5 → §16.4）；
  只保留"`--verify-deps` 做本地对账（声明的包 ⇄ 装的包）"这条事实，设计理由折进 DESIGN §16.1。

## [0.3.8] - 2026-09-24

### Fixed（手工轮子指纹深度审计：一个"五个能力从没报过"的 bug + 名册式枚举 + 文档漂移）

- **平台能力的豁免条件写反**（真 bug）：`deps.ts` 里 `if (entry.platform === true) return true` → 这个文件被当成
  "已经在用首选方案"而 `continue`，于是 **deep-clone / unique-id / number-format / deep-equal / query-string
  五个平台能力从来没报过** —— 而紧邻的注释写的是"平台内置类能力只要命中就报"。改成 `return false`
  （平台内置没有 import 可查 → **没有豁免**）。顺带写清：同文件里也用了 `structuredClone` 也不能豁免 ——
  JSON 深拷贝会丢 Date / Map / undefined，那仍然是 bug。
- **`allowOwn` 只改了 hint，没真降级**：数据表说"只提示不报错"，实现里 finding 仍是 error。新增
  `Finding.severity` 覆盖 + `severityOf()` 读它 → P06 对 allowOwn 能力（query-string 等）**真的降级为 warn**；
  同时修掉 `toJsonReport` 里"每条 finding 的 severity 直接读规则严重度"（与 counts / 退出码不一致）。
- **名册式枚举成族**（与上一轮 datetime 的 `getDay` 同一类）：
  | 能力                               | 旧（漏）                             | 补                                                                |
  | ---------------------------------- | ------------------------------------ | ----------------------------------------------------------------- |
  | `cli-args`                         | 只认 `argv.slice/indexOf/…`          | `process.argv[2]` + `filter/forEach/map/reduce/some/every`        |
  | `unique-id`                        | 只认 `toString(36)`                  | 2/8/10/16、`toString().slice()`、经典 uuid v4 拼装片段            |
  | `number-format`                    | 只认一种分组正则                     | "正则里出现 `\d{3}`"                                              |
  | `deep-equal`                       | 只认 `===`                           | `==` / `!=` / `!==`（宽松相等更常见）                             |
  | `query-string`                     | 只认 `'?'.concat(`                   | `'?' + x`、模板串 `` `?${x}` ``、手写 `encodeURIComponent(k)+'='` |
  | `deep-clone`                       | **没有 `softSyntax`** → P07 永不参与 | 自研递归克隆的弱指纹                                              |
  | `debounce-throttle` / `validation` | 各 2 / 1 条                          | rAF 与 `performance.now()` / `new RegExp(` · `.match(` · `.exec(` |
- **`apiNames` 必须与 `softSyntax` 成对**：多个条目只写了 apiNames，命名指纹永远读不到（死声明）。
  新增**数据表自检**测试断言这条 —— 它正是能提前发现"声明了却永不生效"的那类断言。
- **新增夹具 `__fixtures__/wheels/`**：五个平台能力的手搓样本 + `argv[2]` + 宽松 `==` + 自研递归克隆 +
  **合规写法零命中**（`structuredClone` / `crypto.randomUUID` / `Intl.NumberFormat` / `isDeepStrictEqual` / `URLSearchParams`）。
  这个 bug 能活下来，就是因为**此前没有任何夹具覆盖平台能力**（datetime 夹具只覆盖 datetime，deps 只覆盖 cli-args）。
- **文档漂移对齐**：DESIGN §16.2 的规则表把 **P08 / P09 / P10 当成已实现**（同一文档后面却写着它们没实现），
  P07 的判据写成"≥2 个 API 名重叠"（实际是**精确同名，1 个即可**）；PARADIGM 有 4 处把 P08 当本体规则。
  现在表格只列本体真在跑的规则，其余编号写明"并入 / 已委派"。

### Changed（datetime 能力：补上「字符串日期解析」这条漏网）

- 起因是问「datetime 没限制 `new Date` 吗」。核实结果：**`new Date()` / `Date.now()`（取当前时刻）与
  `new Date(ms)`（时间戳）是故意不管的** —— 它们是原生原语，不是"手搓库"；禁掉只会制造误报。
  这个语义现在写进了数据表头部：**登记能力 = 这个能力的活走登记方案，不是禁用语言原语**。
- **实测出的缺口**：字符串日期**解析**这一格完全没人管 —— `new Date(s)`、`Date.parse(s)`、
  自研 `parseDate(s) { return new Date(s) }` 三种**都不报**。原因有两层：解析形态不在 `syntax` 里；
  而 P07 需要 `softSyntax`，datetime 条目此前**没有这个字段**，所以 P07 对 datetime 永不参与。
- 修法（**纯数据，不动规则**），两处都从"名册"改成"族"：
  - **取/改日期分量按 `Date` 的封闭 API 成族**：`\.get(?:FullYear|Month|Date|Day|…|UTC…)\(\)` +
    `\.set(?:…)\(` —— 旧实现只列了 5 个 getter，`getDay`、`getSeconds`、`getUTCFullYear` 与**全部 setter**
    都漏在外面（实测 `d.getDay()` 一条都不报）。`Date` 的实例方法是 ECMAScript 封闭集合，不会像库名那样过期。
  - **解析**：`Date\.parse\(`（该 API 只用于解析）+ `new Date\(\s*['"]`（只认**字面量**参数）；
    人类可读格式化补 `\.to(?:DateString|TimeString|UTCString)\(\)`（机器格式 `toISOString()` 不在此列 —— 那是序列化）。
  - `softSyntax` 放宽成族（`\.get[A-Z]\w*\(` / `\.set[A-Z]\w*\(`）→ 启用 P07；P07 的精度由**自研同名**把门，只是 warn。
- **两条刻意守住的边界**（写进条目注释与夹具）：
  ① 宽模式 `\.get[A-Z]\w*\(\)` **不用** —— 实测在本仓 + 29 个夹具里它命中 10 处，其中 4 处是误伤
  （`scanner.getTokenPos()` / `getTextPos()` / `node.getEnd()`）；显式族模式同范围命中 6 处，全是真 Date 用法。
  ② `getTime` / `setTime` **不在**族里：取时间戳是合法原生用法，毫秒手算由"与 4 位以上数字运算"那两条专门管。
  ③ `new Date(variable)` 静态判不出是字符串还是时间戳 → 不管（宁可漏也不误伤）。
- 夹具 `__fixtures__/datetime` 扩展：`parse.ts`（解析 → P06）· `week.ts`（`getDay` / `getUTC*` / setter → P06）·
  `dates.ts`（自研 `isSameDay` + 弱指纹 → P07 warn）· **`now.ts` 边界探针**
  （`new Date()` / `Date.now()` / `new Date(ms)` / `getTime` / `setTime` → **必须零命中**；`exact: true` 保证多报即红），
  并打开 P07；`expect.json` 按实测更新。其余 28 个夹具不受影响（自检 29/29）。
- 对应的回归测试从"只数 P06 条数"升级成四段：格式化/取分量 → P06 · 字符串解析 → P06 · 自研同名+弱指纹 → P07 ·
  原生原语与用 dayjs 的文件 → **不报**（把"边界"也钉成断言）。

## [0.3.6] - 2026-09-24

### Fixed（S12 措辞：不再靠"有 JSX"断言"它是组件"）

- **现象**：同一个 `:ui` 检查下两种完全不同的文件收到一字不差的报文 —— 导出元素表的
  `themeModeIcons.tsx`（`Record<ThemeMode, ReactNode>` 里含 `<MoonOutlined />`）与真组件
  `loginPrefs.tsx` 都得到「组件文件必须 PascalCase」。对后者准确；对前者把人指向了"改个名字就变绿"
  的动作，而真实问题（元素表不该以 `.tsx` 待在 `ui/`）原封不动。
- **根因**：第 ② 支的判据是 `hasJsx`（文件里有没有元素字面量），推不出"**导出的**是不是组件"；
  紧邻那条注释的前提「真有 JSX → 它确实是组件」本身不成立。
- **修法（按反馈建议，不动判据）**：② 支改成对两种形态都成立的措辞 ——
  `X 在组件目录里但不是 PascalCase：是组件就改成 PascalCase 的 .tsx；只放元素 / 常量就给 .ts 或挪出 ui/`，
  并把注释的前提改对。
- **为什么不改用 `functions[].isComponent` 选措辞**：它是启发式（首字母大写 + **块体** + 含 JSX），
  实测最常见的 `export const Foo = () => <div />`（**表达式体**）就是 `false`（元素表则没有函数）——
  拿一个会判错的判据去决定措辞，等于"用一个可能错的判据去修一个只是不够具体的报文"，方向是反的，
  还会给最常见的组件写法制造新的错误提示。
- **回归**：`tests/paradigm-consistency.test.mjs` 加了元素表形态，断言**两种形态除文件名外同句**
  （措辞不得依赖"到底是不是组件"这个判不准的事实），并断言旧的无条件断言措辞不再出现。
- **顺带明确**：`findings[].text` / `notices[].text` 都**不是契约**（机读侧用 `rule` / `file` / `line` / `severity` /
  `code`）—— 否则这次改措辞就得是破坏性变更。写进 DESIGN §6.9。

### Changed（性能：`walk()` 不再为每个目录项补一次 `statSync`）

- **根因**：`readdirSync(current)` 只拿名字，类型信息丢了，于是每个条目都补一次 `statSync` 只为问
  `isDirectory()` —— 纯 syscall 浪费，目录树一大就线性放大。
  改为 `readdirSync(current, { withFileTypes: true })`，类型随目录项一起返回。
- **实测**（同进程、同口径、`old`/`new` **交替跑各 6 次取中位数**，避免把冷缓存当优化；文件数一致）：
  本仓 `walk()` **139.6ms → 45.7ms（3.1×）**，109 个 md。端到端 `--check-docs` 现在 **0.20s**
  （启动基线 0.15s + walk 0.046s；改动前同口径约 0.29s）。
  真实大仓的数字来自用户报告：superhive（`dev/` 下有 Go modcache，1131 个 md）`--check-docs` **2.6s → 预计 ~0.9s**。
  三个调用点一起受益：契约扫描（`scan.ts`）、`--check-docs` / `--render-docs`（`docs.ts`）、本体自检（`portability.ts`）。
- ⚠️ 测法说明：我第一次量出"913ms → 43ms"，那是**第一次调用（冷缓存）对之后的热调用**，不是优化幅度。
  所以上面的数字是交替跑的**中位数** —— 这个仓对"看起来漂亮的数字"的要求和规则一样：口径先写清。
- **语义等价不是"顺手改"**：`Dirent.isDirectory()` 描述的是**链接本身**，对指向目录的符号链接返回 `false`；
  而 `statSync` 是**跟随**链接的。直接信 `Dirent` 会不再跟随链接目录 —— 所以只有链接才付一次 syscall，
  且**悬空链接仍整体跳过**（旧实现 stat 抛错就 `continue`，不会把它当文件收进来）。
- **证明方式**：新增 `tests/walk.test.mjs`，把**改动前的算法原样抄一份当参照**（`referenceWalk`），
  在含链接目录 / 链接文件 / 悬空链接 / 忽略名 / 扩展名过滤的合成树上比对，要求**逐项一致** ——
  比"挑几个用例"更能挡住"顺手把链接语义改了"。
- 沿用旧行为未改：目录链接成环时不设防（需要 realpath 记账，属另一件事）。

## [0.3.5] - 2026-09-24

### Changed（**破坏性**：`ok` 语义收窄 → `apiVersion` 1 → 2）

- **`ok` 从"判过的东西没有 error"改成"判过的东西没有 error，而且确实判了"**：
  `ok = errors === 0 && (paths === null || paths.matched > 0) && scopeFiles > 0`。
  实测的漏洞：`--paths` 一个都没匹配上时退出码是 2（"请求无法满足"），而 `ok` 还是 `true` ——
  只读 stdout JSON、拿不到退出码的 CI 脚本 / PR bot 写 `if (!report.ok) fail`，于是**请求没被满足被当成通过**。
  这是 v1 那一轮"让消费方能可靠判定报告内容"漏掉的一格。
- **没有把 `ok` 与退出码对齐**（那会造出 `ok: true` 且 `errors: 3` 的荒谬组合）：
  退出码答「要不要拦」（`--report-only` / `--local-only` 都是"有 error 也退 0"），
  `ok` 答「结论是否通过」。两通道的完整分工表见 DESIGN §6.9（2.0.0）。
- **`REPORT_API_VERSION` 1 → 2**（改字段含义 = 破坏性，按 §6.9 的分级）；冻结测试的版本值与字段清单同步。
  迁移：**只把自报支持的版本号改成 2**；本来就按 `paths.matched` / `diagnostics.length` 判的消费方零改动。
- 顺带补同类的一格：**全量下 0 个文件被判定**（`include` 不限 + 空仓）时 `scopeFiles === 0`，
  那时也没有任何 error —— 现在同样是 `ok: false`（与 S24「0 个文件 → 通过」是同一条道理）。

## [0.3.4] - 2026-09-24

### Added（契约枚举的常量表与守卫，**派生**不是第二份清单）

- 导出 `NOTICE.PATHS_NO_MATCH` 这类常量（kebab-case → `SCREAMING_SNAKE`，类型层用模板字面量推导）
  与 `isNoticeCode()` / `isSkipCode()` 守卫，给**没有类型系统**的消费方（`.mjs` adapter / shell / CI 脚本）用：
  JS 里拼错字符串只会安静地 `false`，而这里会编译期/守卫期就炸；TS 消费方本来就有 `NoticeCode` union 保护
  （实测 `code === 'paths-no-matchh'` 是编译错误），常量表只是方便。
- **两者都从 `NOTICE_CODES` / `SKIP_CODES` 派生**（`constantsOf()` / `codeGuard()`）：加一个 code 只改数组一处，
  不存在"数组改了忘记改常量表"的可能。`tests/report-contract.test.mjs` 冻结了完备性（常量名集合 ↔ 数组一一对应）。
- 这条形状写进 DESIGN §6.9「契约枚举的标准形状」：**单一 const 数组 → 派生 union + 常量表 + 守卫 + 冻结测试**，
  将来的 `severity` / `domain` 等契约枚举照这个模子来（**有消费者才加**，不预先造没人用的表）。
- **「按 code 做对应操作」是另一件事**：常量表防**拼写**，穷举映射防**漏处理**。TS 消费方写
  `Record<NoticeCode, Handler>`（或 `switch` + `never`）就有编译期护栏 —— 实测漏掉一个 code 会报
  `TS2741: Property '"scan-empty"' is missing`，即**我们新增 code 时消费方的构建会红**，而不是静默走 `default`。
  契约变更因此分两级写进 §6.9：**破坏性**（删/改名、改含义、删字段、改退出码 → 必须 bump `apiVersion`）与
  **兼容性新增**（新增 code/字段 → 不 bump，但必须在 CHANGELOG 标注）。
- 模块整理：契约枚举与守卫搬到 `src/engine/codes.ts`（`types.ts` 涨到 508 行，既顶 lint 的 500 行上限、也踩了狗粮的 S16 —— 抽模块而不是抬阈值）。

## [0.3.3] - 2026-09-24

### Changed（**破坏性**：JSON 报告成为带版本的对外契约）

`--format=json` 是 CI 注解 / PR bot / IDE 插件 / agent 的接口，所以它和规则一样是契约。起因是一次真实反馈：
0.3.x 一口气新增了 `skipped` / `exceptions` / `skippedGlobals` / `filteredBySeverity` / `notices` 五个字段，
**没有任何机制**能让"字段变多了"与"字段没变"可区分 —— 旧消费方照跑不误，只是悄悄少显示一类信息
（`S13 没在跑`看不见、`--paths` 零匹配被当成通过）。而**只加版本号解决不了**：没人强制 bump 的版本号只是装饰。

- **新增 `apiVersion`**（`REPORT_API_VERSION = 1`，从包入口导出，消费方可断言）。增删顶层字段 / 增删
  `notices[].code` / 改字段含义 = 契约变更，必须动它；而"必须动"由新增的
  **`tests/report-contract.test.mjs`** 冻结住（顶层字段集与 code 清单都被写死，增删即红）。
- **`notices: string[]` → `Array<{ code, text }>`（破坏性）**：消费方按 `code` 判，**文案不再是契约**。
  `code` 清单单一出处是 `types.ts` 的 `NOTICE_CODES`（23 条，编译期 + 测试双重把关），
  并**从包入口导出**（`exports` 映射不暴露 `./engine/*`，拿不到就等于没有）。
- **机读 ⊇ 人读**：人读摘要里的数字以前在 JSON 里缺一半，现在补齐 `scopeFiles` · `globalFindings` ·
  `rulesEnabled` / `rulesTotal`（`skippedGlobals` / `filteredBySeverity` / `exceptions` / `outsideContract` 已有）。
- **`--paths` 一个文件都没匹配上 → 退出码 2**（原来 0）：它意味着"你要求判的东西一件都没判"，
  是**请求无法满足**，不是"通过"。同时给出 `paths: { requested, matched: 0 }` 与 `code: 'paths-no-match'`，
  消费方不必去匹配中文文案；「没问」（`paths: null`）与「问了没命中」（`matched: 0`）可区分。
  `--report-only` 仍然恒 0（显式的"只看不拦"）。
- `RunResult` 也带上 `pathsMatched` / `notices`（程序化调用方与 JSON 看到同一份自述）。
- 契约与迁移写进 **DESIGN §6.9**（新增）与 README；退出码表补一行。
- 顺带：`fsd()` 关于 `assets` / `providers` 的注释现在**点明这是上游自相矛盾**（`segments-by-purpose` 把
  `providers` 列为 React 坏片段名且对无切片层也生效，源码链接已附），本预选明确"站 linter"。

### Fixed（S12 报文指向真正的修法）

- 新判据「组件目录（`:ui` / `:components:*`）里的 `.tsx` 必须 PascalCase」**压力是对的**，但报文说的是
  「组件文件必须 PascalCase」—— 而 `ui/useThing.tsx` 的真实问题是"hook 住错了目录"。提示指错地方，
  agent 就会去改名字而不是挪文件。现在按**文件的真实形态**分三种说法（`hasJsx` 来自事实模型，判据不动）：
  - 名字以 `naming.hookPrefix` 开头 → 「hook 不该住在组件目录：把 X 挪到 model/ 或 hooks/」
  - 真有 JSX → 「组件文件必须 PascalCase」（它确实是组件，只是名字不对 —— 原报文准确）
  - 没有 JSX 也不是组件名 → 「X 不是组件却住在组件目录：这份 .tsx 里没有 JSX，纯逻辑请放 model/、或改成 .ts」
    三者都带上修法提示（pretty 报告渲染成 `→ …`）：组件目录只放组件，hook 与纯逻辑另有位置。
    回归见 `tests/paradigm-consistency.test.mjs` 第 ⑥ 条。

## [0.3.2] - 2026-09-24

### Fixed（五处「声明了却不生效」——同一类病，来自一次真实反馈）

全部先复现、再修；每一条都配了回归测试（`tests/paradigm-consistency.test.mjs`，7 条）：

1. **`--explain` 在 FSD 下给库范式的建议**：`placementHint` 只看 `layout`，而 `fsd()` 的 `layout`
   沿用的是 `library()` 那套（`modules` / `shared` 都是空串）→ 掉进库分支，输出
   「先在 `library({ modules })` 里补上」。修法：`Config` 现在**真的带上 `paradigm`**
   （此前只有 `loadConfig` 的范式唯一性校验在读它，没进合并配置），并给 FSD 一条从**角色表**读的
   落点分支（层 / 切片 / 片段按角色表念，自定义过的 FSD 也给得对）。
2. **S12 / S13 在 `fsd()` 下 100% 空转**（全靠 `record.slot` 与 canonical 专属 role 字面量）：
   S12 的 api / 组件命名改成**按角色后缀**判（`fsd:shared:api` 与 `shared:api` 语义相同 → 都会判）；
   S13 则需要槽位语义 → 新增参数型能力 `structure.slots`（canonical 声明，library / fsd 没有），
   于是它在那两个范式下**明列停用**，而不是"注册了却永远判不出东西"。
3. **`thresholds.viewLines` 在 FSD 下静默失效**（同一份 153 行页面：`viewLines: 100` 不报、`fileLines: 100` 才报）：
   新增角色描述符字段 **`pageLike`**（canonical 的 `module:views`、FSD 的 `pages/<切片>/ui`），
   S16 用它决定 `viewLines` / `fileLines`；**没有任何页面级角色的范式配了 `viewLines` 时，报告当场自述
   这条阈值不会生效**（D21「声明了却零匹配」的同款套路）。
4. **`naming` 只有 S12 / S13 消费**，上面两条死了它却还在被 `--explain` 打印：现在没有 views / hooks
   槽位就不打印命名契约，并给出一句原因（"承诺了却不执行"比不写更糟）。
5. **D16 与官方 `app/styles` 片段打架**：D16 原来只豁免 `styleDir` → `src/app/styles/probe.css`
   被判「非 CSS Module 的样式文件出现在组件目录」（文案也不对）。现在豁免**声明过的三个落点**
   （styleDir / tokenDir / vendorDir），文案改成"全局 CSS 只许放声明的样式落点"；同时 `fsd()` 的
   `styleDir` 归位到官方的 `app/styles`（全局样式），令牌与第三方覆盖仍在 `shared/ui/styles/{tokens,vendor}`。

### Changed（适配表边界：`packages` 是"必须装的"，不是"整套库的清单"）

- **`antdKit().packages` 去掉 `@ant-design/x`**（AI 界面套件，antd 生态的**可选扩展**）。
  它列在那里时，P04 正向会要求**每个** antd 项目都装上它 —— 哪怕一行都不用；`allow` 已开启的项目还得多抄一行。
  现在只剩 `['antd', '@ant-design/icons']`。
- **删之前先确认过不会变成误报**：P04 反向用的是 `fingerprintsOf()`（返回**别套**：`!kit.packages.some(pkg => owned.has(pkg))`），
  按**套**判而不是按包判，而 `@ant-design/x` 仍登记在 `data/kit-fingerprints.ts` 的 antd 条目里 ——
  所以"装了它"既不会被判"混进别的组件库"，`--verify-deps` 也照样对账通过（实测）。
- 新边界写进 DESIGN §7.1：「**`packages` 是「你必须装的」，不是「这套库的全部包」**」——
  同生态的可选扩展（`@ant-design/x`、`@ant-design/pro-*`、`@ant-design/charts`…）不该列进来；
  但 `allow` 已开启时，装了什么就得自己写进 `allow`（项目决定，不是适配器替你决定）。
- 夹具 `allowlist-adapters` 随之只装 `antd` + `@ant-design/icons`（它的断言是"适配表 packages 并入白名单"，与包数无关）。
- 新增 `tests/kit-packages.test.mjs`（5 条）：不装它不再违规 · 装了它 P04 不报 · `allow` 开启时要自己登记 ·
  **反向没被削弱**（装了 `element-plus` 照样报）。

## [0.3.1] - 2026-09-24

### Changed（`fsd()` 按官方 v2.1 对齐）

- **补上官方 shared 典型段 `routes`**，app 典型段补 `routes` / `store` / `entrypoint`
  （实测：这些官方写法此前被判「S01 无处安放」）。
- **支持官方的"环境特定公开面"** `index.server.{ts,tsx}` / `index.client.{ts,tsx}`
  （app 层与四个切片层各加一条角色，且同样标 `entry: true` —— 它就是那个切片的公开面）。
- 角色描述符 38 → **45**；新增 `tests/fsd-conformance.test.mjs`（4 条）：官方典型段与 `index.server` 不被误报、
  核心规矩（S21/S22/S23）照旧，以及**已知偏离被故意钉住**。
- **记录一处未实现的官方能力：`@x` 跨引用公开面**（`entities/A/@x/B.ts`）。它是官方唯一的"同层跨切片"合法通道，
  要支持得给 S22 开例外并限制在 entities 层；当前替代是把这类联系提到更高层（官方也说"尽量少用"）。
  源码注释与 `ALTERNATIVES.md` §3.5 的对照表都写明了这一点，免得下次又被当成 bug。
- 逐条对照表（含 ✅/⚠️/❌）落在 `docs/ALTERNATIVES.md` §3.5。

## [0.3.0] - 2026-09-24

### Changed（忽略分三层：宿主 `ignore` + `.gitignore` 基础层 + 产物目录数据表）

- **通用产物目录名册从引擎常量变成数据表**（`src/data/build-output-dirs.ts`）：`node_modules` · `dist` · `build` · `out` ·
  `coverage` · `.next` · `.nuxt` · `.output` · `.svelte-kit` · `.angular` · `.parcel-cache` · `.vite` · `.cache` ·
  `.pnpm-store` · `.yarn` · `bower_components` · `.git` · `.turbo` · `.arch-guard-cache`。宿主忘了把它们写进 `ignore`
  也不会去解析一堆生成代码；名单是可评审、可扩展的纯数据，引擎只负责用它。
- **`.gitignore` 作为基础层自动生效**（新增 `gitIgnoredPaths()`）：**问 git** 而不是自己解析 ——
  `.git/info/exclude`、全局 excludes、子目录各自的 `.gitignore`、`!` 否定全部算数；自己写的解析器错一条就是"多跳了 = 静默不判"。
  宿主 `ignore` 仍在它之上继续追加（两层叠加，谁都没被替代）。三条边界规矩：
  ① **只作用于契约域外**（契约域内即使被 gitignore 也照判 —— 宁可吵，不可静默不判）；
  ② 只列**未跟踪**的忽略项（被跟踪的文件永远不受 `.gitignore` 影响，所以提交在仓库里的源码不会被误跳）；
  ③ 没有 git / 不是仓库时**整层降级关闭**，回到 ①+③。
- **跳过什么必须自述**：新增 `因 .gitignore（git 判定）跳过 N 个文件`（与 `ignore（项目边界）命中 N 个` 同级）。
- 顺带修掉一个解析坑：`git ls-files --directory` 对目录输出 `gen/`，而 `path.relative` 会把结尾斜杠吃掉 →
  **先记住再归一化**，否则前缀匹配失效（测试当场抓到）。
- **`ignore` 跳过数现在会自述**：`ignore（项目边界）命中 N 个文件，未进文件集也不解析：<glob 列表>`。
  此前报告完全不提它 —— 宿主把某个源码目录误写进 `ignore` 时，表现是"悄无声息地不判了"。
- 顺带把编排里的「读源码 → 提事实 → 缓存」抽成 `src/engine/collect.ts`（`runGuard` 又顶到了函数长度上限，
  与 `git.ts` / `filters.ts` 同一处理方式：抽模块，不抬阈值）。
- 新增 2 条测试：产物目录默认不进文件集、`ignore` 跳过数在报告与 JSON 里都可见。

### Added（`--render-docs` / `--check-docs`：文档与门禁同一份真相）

- **文档里的那几张表改为从 `arch.config.mjs` 渲染**（DESIGN §7.3 承诺了很久，现在落地）。在文档里包一块：
  ```md
  <!-- arch-guard:begin deps -->
  <!-- arch-guard:end deps -->
  ```
  `--render-docs` 重写块内容，`--check-docs` 只校验（不符即红）。`pnpm check` 已接 `--check-docs`。
- **块名即登记名**（`src/engine/docs.ts` 的 `DOC_BLOCKS`）：`deps`（能力表 + 批准清单）· `thresholds` · `layout` ·
  `structure` · `scan-scope`（include / ignore）· `roles`（角色表）· `params`（落点）· `exceptions`（规则级例外）。
  **拼错直接报错**；未闭合 / 不配对 / 嵌块同样报错；一个块都没有时明说"没有任何文档管理块"（不许安静通过）。
- 本仓 `AGENTS.md` 已接三个块（`roles` / `deps` / `thresholds`）—— 在此之前 AGENTS 目录表与 `arch.config.mjs` 是**两处手抄**。
- 两条狗粮踩出来的边界（都写进实现与测试）：
  ① **围栏代码块里的示范标记不算真块** —— 否则"在文档里示范块语法"会把自己判红（本仓 README / CHANGELOG 正是这么踩的）；
  ② **排版不算漂移** —— `prettier --write` 会把表格按列对齐、把分隔行按列宽拉长，所以比较前先归一化空白与分隔线长度
  （事实是单元格内容，不是留白；否则引擎就得去复刻 prettier 的排版算法，那是第二份真相）。
- 新增 `tests/docs.test.mjs`（8 条）：块名拼错 / 未闭合 / 不配对 / 嵌块、只改块内内容且幂等、
  `--check-docs` 指名文件与块、`--render-docs` 后转绿、config 一改块就变（阈值 × 批准清单）、
  没有块时明说、`docs/**` 里的块也扫。

### Added（`--explain`：把约束前移到写之前）

- **新增 `arch-guard --explain <路径>`**：给出这个路径的**契约** —— 角色（id / 层号 / 槽位 / 域 / 组）、
  **能依赖谁**（层序单向 S21 + 域内/域外 import 规则 S04–S06 + 组隔离 S22 + 公开面 S23）、命名契约、
  与落点有关的路径参数（令牌 / 样式 / 存储 / i18n）、以及**本配置启用的规则清单（逐条带修法）**与因能力停用的规则。
  目的是给 agent 的那一半：门禁平时只在事后说"你错了"，而"我要写的这个文件是什么角色、能 import 谁、该放哪"
  全是**既有数据**（角色表 + 布局 + 结构声明 + `params`）——**一条规则都不用跑，零误报**。
- 路径**还没写**也能问：命中不了任何角色 → 直接给出「该放哪」（复用 S01/S03 的 `placementHint`，不是第二处真相）。
  域外 / `ignore` / 资源文件 / **角色歧义**都会明确说清（歧义会点出全部命中角色）。
- `--format=json` 给结构化结果（agent 消费）；一次可问多条（逗号分隔）；支持绝对路径（IDE / agent 按文件传参的形态）；
  **退出码恒为 0**（这是查询，不是判决）。
- 实现要点：把角色匹配从 `scanProject` 抽成 `buildRoleIndex()` / `resolveRole()`，**全量扫描与解释共用一份实现** ——
  否则"解释"和"判定"迟早给出不同答案，而 agent 会照着错的那份写代码（新的假绿来源）。
- 新增 `tests/explain.test.mjs`（7 条）：命中 / 无处安放（给落点）/ 域外 / ignore / 歧义 / 绝对路径 + JSON / 多条路径。

### Changed（例外从「文件免检」收窄为「规则级例外」）

- **删掉文件级 `exempt`，换成 `exceptions: [{ rule, glob, reason, expires? }]`**。区别是决定性的：
  文件级豁免命中的文件**不进角色表、不解析事实、所有规则一起停看**（为了一条规则把整个文件免检，
  在依赖图里只留一个没有边的孤立节点）；规则级例外是对**发现项**做后置过滤 —— 文件照常有角色、进图、
  被其它规则判定，只有指名的那条规则被摘掉。
- **三重把关**：`rule` 必须真实存在（拼错 = 例外根本没生效 = 假绿 → 直接报错）；`reason` 必填（进 diff 可评审）；
  `expires`（`YYYY-MM-DD`）写了就**过期即红**，逼你续期或删掉。
- **例外必须透明**：每次运行点名每条例外（命中几处 / 未命中），未命中的提示「可能可以删掉」；
  摘要与 JSON 都给出 `例外 N 处 / M 条声明`。不透明的例外就是隐形的门禁关闭。
- 三种需求的分工写进文档与 CONTEXT：① 这片树不属于契约 → `include` / `ignore`；② 这条规则对它不适用 → `exceptions`；
  ③ 暂时不想修 → **没有这个通道**（基线已移除）。
- 本仓自己那条 `exempt: [{ glob: 'src/engine/output.ts' }]` 一并删除 —— 实测摘掉后狗粮照样全绿
  （`console.*` 那条规则 H03 已委派 eslint，本体没有规则会命中它），它是装饰而非承重。
- DESIGN §14 的 **R4 缺口随之关闭**（例外已有理由 + 期限）。
- 新增 `tests/exceptions.test.mjs`（5 条）：只摘指名规则而文件仍被其它规则判定、未命中要点名、
  规则 id 拼错 / 过期 / 缺字段全部 fail-closed。

### Removed（违规基线：门禁不再接受存量豁免）

- **`arch.baseline.json` 与 `--update-baseline` 一并移除**：违规必须修，**不符合规范就是红**。
  唯一例外只剩 config 的 `exempt` 白名单（现在**必须写理由**，缺理由在配置加载期直接报错）。
- 为什么移除：该机制同时满足「**永久**（条目无期限）+ **一键重写**（写全部当前违规）+ **锚点被格式化干掉**」。
  于是"重新写基线"永远比"修"便宜 —— 实测：2 条违规 → `--update-baseline` → 全绿；再加一条 → 红 → 再写一次 → 全绿（豁免数还从 4 涨到 6）。
  门禁的结论从「符合规范」退化成「没有新增违规」，而后者可以被无限刷。**跳过门禁的成本是 0**，这与"约束 agent 编码质量"直接冲突。
- 连带的接口变化（破坏性）：`Config.baselineFile`、`RunOptions.updateBaseline`、报告里的 `豁免 N` 与"过期豁免"提示、
  `index.ts` 的 baseline 导出（`loadBaseline` / `applyBaseline` / `saveBaseline` / `entriesFromFindings` / `anchorFor` / 相关类型）
  全部删除；`src/engine/baseline.ts` 删除（140 行）。
- **覆盖率棘轮（M04）保留**，但它与豁免无关：快照改由新开关 **`--update-coverage`** 刷新（写 `arch.coverage.json`）；
  没启用棘轮或产物读不到时**明确说"未写快照"**，不静默。
- 旧仓库若还留着 `arch.baseline.json`：文件被忽略，并在报告里提示「违规基线机制已移除」（不许静默）。
- 顺带解决的历史冲突：DESIGN §14 记过的「fixer × 棘轮」冲突随基线一起消失（`--fix` 仍不在 v1 范围）。
- 新增 `tests/no-baseline.test.mjs`（4 条）：手写基线也不再豁免且明确提示、`--update-baseline` 开关不存在（退出 2）、
  `exempt` 缺理由即 fail-closed、`--update-coverage` 只写覆盖率快照而不豁免任何违规。

### Fixed（vendor 边界：D10 漏检变量、P11 锚点误报）

- **D10 现在也守变量前缀**（DESIGN §5.2 一直是这么写的：「选择器前缀**与变量前缀**只许出现在 `styles/vendor/**`」，
  而实现只遍历了 `file.selectors`）：`--ant-*` 出现在 vendor 目录之外——无论定义（`--ant-local: …`）
  还是引用（`var(--ant-color-primary)`）——都报错。实测漏检：把变量放进 `src/shared/ui/styles/base.css`，
  `--only=D10,D10b` **零报告**，正是这条规则要防的假绿。
- **P11 不再误报「零使用」**：原先拿适配器的原始正则去 test **整份文件文本**，而 `vendorVars` 写的是 `^--ant-`
  （本意是"变量名开头"，没有 `m` 标志时却成了"文件开头"）—— 变量不在第一行就检测不到，
  于是**只在 CSS 里用组件库变量**（不 import 包）的项目被无端 warn。现在 D10 / D10b / P11
  **共用 `design-shared.ts` 的 `vendorPatterns` / `usesVendorPatterns`**：编译一份，匹配**解析后**的选择器与变量名。
- 夹具与测试：新增 `__fixtures__/vendor-var-leak`（变量漏到 vendor 之外，同时钉住 P11 不误报）+
  `tests/vendor-boundary.test.mjs`（4 条：D10 定义/引用各报一条、vendor 内合法零噪音、
  P11 认出 CSS-only 用法、P11 真的零使用仍报 warn）。

### Fixed（过滤器与空扫描域：三条「绿而不自述」的洞）

- **新增规则 S24「契约扫描域不得为空」**：`include` 非空却一个源码文件都没匹配到 → **error**，并标为全局
  （`--scope=changed` 下默认仍然失败，不许静默丢弃）。此前只有「认不出的元框架」那一轴被守住，
  `include` / `srcRoot` / 预设 `layout` 打错一个字母就会「0 个文件 → ✔ 通过」——PARADIGM §11 明说过这是**假绿**。
  `include` 为空（不限扫描域）时不判：空仓库是合法形态，改由报告 notice 自述「没有任何东西被判定」。
  新夹具 `__fixtures__/scan-scope-empty`（违规侧）。
- **`--severity` 过滤必须自述**：以前在有 error 的项目上跑 `--severity=warn` 会打印「✔ 架构守卫通过」而不交代被滤掉了什么。
  现在 notice + 摘要行 + `RunResult.filteredBySeverity` + JSON 字段四处都给条数（照 `--local-only` 的先例）。
- **`--paths` 一个文件都没匹配上必须自述**：路径打错时以前安静通过；现在明确说「0 个文件被判定，别当成通过」。
- **JSON 报告补 `notices`**：这些自述以前只存在于人读的那一行里，CI / agent 看不到；现在机读侧同样可见。

### Changed（夹具精确性：从「只查漏报」到「漏报、多报都查」）

- 12 个夹具此前没写 `exact: true`，而自检默认**只查漏报、不查多报**（`self-test.ts`）——
  实测它们本来就精确（0 漏报 / 0 多报），但那是「碰巧」，不是「被守住」。现在 **28/28 全部 `exact`**：
  将来任何规则多报（= 误报，本仓第一红线）都会让门禁直接红。
  维护提示：改写 `expect.json` 时**必须保留 `unitOnly` 之类的声明字段**（`coverage` 夹具用它登记由单测覆盖的 M05/M06）。

### Fixed（scope 的安全语义：承诺了却没实现的那两条）

- **`--scope=staged` 现在真的读 index 内容**（`git show :<path>`），不再读工作区文件。这是 pre-commit 的经典 bug：
  用户 `git add` 之后继续改文件时，工作区是"下一版"、index 才是"这次要提交的" —— 旧实现会报出用户没打算提交的改动
  （假红，hook 被绕过），也会漏掉 index 里的违规（假绿）。取不到 index blob 的（staged 删除 / git 报错）退回工作区内容，
  并在报告里明列文件名 —— 不许静默换语义。新增 `tests/scope-safety.test.mjs`（index 干净 × 工作区违规、反向两组对照）。
- **`--local-only` 跳过的全局违规条数必须可见**：以前只是把不可归属的全局违规从报告里滤掉，摘要仍旧显示"全局违规 0"
  （DESIGN §6.8 退出码表要求"零，但打印跳过条数"）。现在 notice、摘要行、`RunResult.skippedGlobals` 与 JSON 报告
  四处都给出条数；默认行为不变（全局违规仍然失败）。
- 文档/实现对齐（本仓自己的公理 1：真相唯一）：`--staged` 的语义、P07 的实现状态（已落地，此前三处文档写"未实现"）、
  `--verify-deps`（本地对账已落地 / 联网成熟度未实现）、facts 缓存键（`rel + role + 内容 sha1`，不含"配置哈希/规则集版本"，
  因为 facts 与规则无关）、§6.2 目录树（`src/**/*.ts`，不再写已不存在的 `tools/arch-guard/*.mjs`）、§1.2 依赖口径
  （改为"显式登记的审查门"，与 `commander` + P1 白名单一致）、README 的四条不变式（补 P4）与 Roadmap。
  另修 §7.0.1 里与下一节自相矛盾的一条（库范式"走三根兜底"的旧口径：现在**没有兜底**，缺落点即明列停用）。

### Changed（真相收敛）

- **阈值与命名契约只剩一份默认值**（`src/engine/defaults.ts`）：此前 `config.ts` 的兜底、`canonical()`、`library()` 各写一遍
  （`hygiene()` 里还有第四份 `functionLines: 150`），改一处另外几处静默漂移。现在三者都从同一处取，行为不变；
  `tests/presets.test.mjs` 加了一条守卫（三个范文的阈值/命名必须等于唯一默认值）。
- **删掉死字段 `Config.addRoles`**：它被赋值却无人读（`roles` 已含追加结果），留着就是同一事实的第二处存放、
  将来谁读了就会把角色重复计入。`addRoles` 仍然可以作为宿主的 `overrides` / 预设输入使用（新增 `ConfigOverrides` 类型承载它）。
- `--verify-deps` 的输出不再暗示"依赖成熟度已把关"；PARADIGM §12.5 / DESIGN §16.4 标注联网部分未实现。

### Changed（狗粮配置：只留真有消费者的轴）

- **`arch.config.mjs` 去掉 `hygiene()`**：它只贡献 H06，而 H06 需要 `uiKit.detachedApis` 能力 ——
  本项目永远不会用组件库，所以那是一条**净贡献 0、永远停用**的声明（实测：去掉它启用规则数不变）。
  H 域在本仓靠 eslint 那侧覆盖（H01–H05 按 §4.9 委派）。**这是取舍不是缺陷**：想让"H 域评估过"留在报告里，加回一行即可。
- **`arch.config.mjs` 补 `metrics()`**：M 域（8 条规则）此前一条都没在本仓跑过。现在装两条**没有产物依赖**的：
  `tests.checkChain` → **M09**（`check` 链路必须真的包含 test 与 coverage —— 门禁自己漏跑只有门禁自己能查）、
  `depsBudget.runtime: 1` → **M07**（本体只许一个运行时依赖；加第二个要改配置，diff 可见）。
  实测狗粮从 15/55 → **17/55**，新增两条今天就是绿的，且都真的会失败（把 `pnpm test` 从 check 里摘掉 → M09 立即报错）。
  依赖覆盖率产物的 M02–M06 与 M08 仍是**明列停用**：M06 要求产物比 HEAD 新，装上会让 `pnpm guard:self`
  变成"必须先跑覆盖率"；M08 要求源文件被测试 import 或同名配对，而本仓测试是**分组测试 + 跑构建产物**（import `es/`），
  实测会一次报 24 条结构性 error（不是代码问题），装上等于削弱门禁。
- `arch.config.mjs` 另补：`specVersion: '1'`（配置格式版本不一致时显式报错）、`packs: [...]` 显式声明（不再依赖 CLI 兜底包）、
  `.scratch/**` 进 `ignore`（一次性 spike 不属于项目源码树）。
  注：写 `packs` 的收益是"配置自述用了哪种源码形态"，**不是**"让 facet 白名单校验生效" ——
  那条校验一直通过 CLI 兜底包在跑（`loadConfig` 见到 pack 就校验），此处更正我先前的说法。

### Changed（pack 轴：`framework` 指源码形态，不是"用了哪个框架"）

- **新增 `tsPack`（`framework: 'typescript'`），本仓改用它。** 起因是一个纯 TS 库/CLI 竟被 `reactPack` 量：
  根因是 v1 只有一个叫 "react" 的包，而它实际承载的是「TS/TSX parser + 全部规则」——
  `framework` 只驱动两件事（哪些扩展名归本包管、S20 的报错文案），**没有任何规则按它分支**（已核对）。
  现在：`src/packs/core/rules/` 存放**共享规则实现**，`packs/typescript` 与 `packs/react` 是两份 pack 声明，
  今天引用同一份 `coreRules`（v1 没有任何 JSX 专属的**已实现**规则：C01 / D15 已委派）；
  JSX 专属规则落地时它们的家是 `packs/react/rules/`，那时两者才真正分化。
- **引擎默认源码形态从 `react` 改为 `typescript`**（`framework-sources.ts` 里第一个已实现项）：
  引擎不该假设前端框架。扩展名集合两者相同，所以行为零变化，只有标签与 S20 文案跟着变。
- 公共 API：`reactRules` → **`coreRules`**（从 `arch-guard` 与 `arch-guard/packs/core` 导出）；
  新增 `tsPack`。CLI 的兜底包**仍保持 `reactPack`** —— 忘了写 `packs` 的 React 宿主（会配 `uiKit`）不静默变红。
- 文档同步：PARADIGM §11（pack = 源码形态 + 两者今天共用规则集）、DESIGN §6.2 目录树 / §7.1 源码形态轴 / §7.5 pack 职责、
  CONTEXT 的 pack 词条、README 配置示例、AGENTS 目录表；新增 `tests/packs.test.mjs` 钉住
  「默认形态不是 react / 两包规则集一致 / packs 与 metaFramework 一处真相」。

### Added（可判定性的锚点写清）

- `docs/adr/0006-primitives-are-vocabulary.md`：十个检测原语是**分类词汇**，不是引擎里的一层（实现里没有 primitives 模块）。
  可机检的锚点是「`createRule()` 契约 + 每条规则的夹具对」；PARADIGM §3.1、CONTEXT.md、DESIGN §6.7 同步写明。
- **`tests/preset-matrix.test.mjs`：把 DESIGN §7.0.1 的「96 种组合穷举」从"手工跑过一次"变成回归保护。**
  逐条断言组合语义本身：`enable` 是各贡献者的**并集**（任取 'all' 则整体 'all'，且 32 个域子集必须给出 32 份不同规则集
  —— 谁都不能被顶掉）、`structure` 是**加法**、`roles`/`layout` 来自范式（域预设不许动）、
  落点**随范式**且域预设只写显式给的、同一预设写两遍幂等、范式两两混用 fail-closed、`disable` 在 registry 侧真的做减法。
- README「质量保障」补 P4 自检与 `pnpm check` 的实际链路；`/coverage.txt` 移出版本控制并加进 `.gitignore`
  （它是本地日志，README 的测试数/覆盖率数字跟着它一起过期过）。

### Changed（原子化收尾：落点不兜底、死参数删除、`all` 语义写清）

- **D 域落点不再兜底三根路径**：`designParams()` 只认项目/范式声明过的落点，依赖落点的 8 条规则
  （D03 / D06 / D07 / D08 / D10 / D10b / D16 / D21）改成 `requires: ['designSystem.<字段>']` —— 缺落点则**明列停用**。
  实测：`library() + designSystem()`（不声明落点）→ `因能力未声明而停用 8 条规则：D03 / D06 / D07 / D08 / D10 / D10b / D16 / D21`；
  以前它们会悄悄去量 `src/shared/styles`（只有 D21 的"零匹配"警告算线索）。
- **删掉三个没有消费者的参数**：`spacing` / `lengthProps` / `allowLengthValues` —— 它们是"魔法数字三族"（D12–D14）的输入，
  而那几条已委派 stylelint / eslint。实现时按 `requires: ['designSystem.<字段>']` 加回。
- **`enable: 'all'` 的语义写清并加测试**：它是"该 pack 的全部规则"（应用范式 `canonical()` 的有意默认）；
  收窄用 `disable`（减法），`overrides.enable` 是**整体替换** —— 三条都有单测钉住。
- 文档：DESIGN §7.0 组合语义表补 `all` 说明 + 新增「落点不设兜底默认」一条。

### Added（组合方案 `stack()`：原子预设 + 一层不含硬编码的糖）

- 新增 **`stack(options)`**：把域预设按需装配成 `presets: [范式(), ...stack({ … })]`。三条约束写进实现与文档：
  ① **不含任何硬编码**（组件库 / i18n 方案 / 语言 / 白名单 / 落点全部由选项传入，不传就用"声明空能力"的
  `noneKit()` / `noneI18nKit()` → 对应规则**明列停用**）；② **不引入新语义**（只是拼
  `designSystem()`/`copy()`/`deps()`/`hygiene()`/`i18n()`/`uiKit()`/`metrics()`，用户可以不要它、手写同样几行）；
  ③ **范式仍只有一个**（`stack()` 只管正交的域轴）。
- 顺手修掉一个语义 bug：`noneI18nKit()`（"项目不用 i18n"）以前也会被范式的 `params.i18nDir` 补上落点，
  于是 C 域照跑、C07 还会误报"声明了 i18n 却零资源"。现在**只在适配器声明了 i18n 库（`from` 非空）时才补落点**。
- 拆出 `presets/kit.ts`（`uiKit()` / `i18n()`），避免 `stack()` 与 `presets/index.ts` 循环依赖。
- 测试：`tests/stack.test.mjs`（6 条）—— 默认空能力 · 选项驱动 · 落点仍随范式 · 组合 = 各域并集 ·
  `hygiene: false` 与 `metrics` 按选项生效 · "不用 stack 手写同样几行结果一致"。
- 文档：README 配置模板换成 `...stack({ … })`；DESIGN §7 增「组合方案」小节；ALTERNATIVES §3.5 配方改用 `stack()`。

### Added（P4 自检：库名只许出现在数据表与适配器面）

- **兑现 docs/DESIGN.md §7.3 早就写下的承诺**：`engine/**`、`packs/**` 与通用预设（`presets/*.ts`）不得出现已登记库名，
  违反即门禁自身报错。`portability.ts` 以前只有 P1/P2/P3，所以库名可以随便躺在引擎里。
- 名单**不新增第二份**：从允许位置（`data/*` 与 `presets/<面>/*`）按约定登记（`from` / `packages` / `preferred` 数组，
  或常量名含 `Packages`/`Kits`/`Names`）**自己长出来** —— 新增 kit 自动纳入扫描。
- 只收**包名形状**的名字（`@scope/x`、含 `-`/`.`）：纯单词库名（`antd`、`bootstrap`）与项目里的槽位名无法区分
  （`canonical.ts` 的 `slot: 'bootstrap'` 就是误报来源），收了就是误报 —— 这条限制写进 hint 与 §6.7。
- 实测：往通用预设里注入 `from: ['react-i18next']` → `[P4] 库名只许出现在 presets/<面>/* 与 data/*：react-i18next`；撤销即恢复通过。

### Changed（库名归位：data 表 + 适配器面；i18n 拆成 kit；死声明清理）

- **`i18n` 适配器从通用预设里搬走**：`copy()` 现在**只贡献 C 域规则集**（不再内联 i18next 适配器、不再收 `resourceDir`/`languages`/`fn`/`hook`）。
  能力改由 `i18n(i18nextKit({…}))` / `i18n(noneI18nKit())` 提供 —— 与 `uiKit(adapter)` 完全同形，
  库名只出现在新的 `presets/i18n-kits/*`。修掉的旧后果：`--verify-deps` 拿 `from: ['i18next','react-i18next']`
  对账 package.json，项目换了 i18n 方案却还留着 `copy()` 就误报"声明了 i18next 却没装"。
- **引擎/框架包里的库名归位到数据表**：`engine/deps-audit.ts` 的 `KNOWN_KITS` 删除，改用既有的
  `data/kit-fingerprints.ts`（本来就是同一份数据的第二真相）；`packs/.../deps-adapters.ts` 的硬编码图标名单
  移到 `data/icon-packages.ts`。
- **删掉 `tokenPrefix`**：它没有任何消费者（D02/D18 未实现），而且是**宿主 superhive 的前缀**做通用/引擎默认 ——
  正是 P2 要防的那类宿主字面量。实现 D02/D18 时以 `designSystem({ tokenPrefix })` + 参数型能力加回
  （`registry` 新增参数型能力根：`designSystem.x` 读 `config.params.x`，缺它则规则**明列停用**）。
- **死声明清理**（按"声明必须有消费者"）：
  - 三个**零消费者** facet（`router` / `data-layer` / `styles`）从 `FACET_FIELDS` 与 `CAPABILITY_ROOTS` 删除；
  - `ui-kit` 的 `styleProps` / `policy` /（此前）`themeIntegration` 三个字段删除；
  - **`Pack.adapters` 从死声明变成 fail-closed 校验**：宿主配的 facet 必须被该 pack 支持，否则报错；
    react pack 的清单同时修正为 `['ui-kit','i18n','metrics']`（原来列了 3 个没人读的，反而漏了 metrics）。
- 测试/夹具同步：`tests/preset-compose.test.mjs` 的 i18n 用例改按新语义（`copy()` 不带适配器时**没有能力**、
  由范式补落点）、能力守卫表改成"谁负责**启用**规则"（`copy()` 而不是 kit）、`declared-gap` 夹具补上 i18next 依赖
  （P04 现在也拿 `from` 对账）。

### Changed（C 域预设**保持叫 `copy()`**：不加 `i18n()` 别名，改为让后果可见）

- 用户反馈"看到 `copy()` 想不到这是 i18n"。按设计逐条推：**预设名 = 域名 = 概念名**（域表是 S 结构 / D 设计系统 /
  **C 文案** / P 依赖 / H 反退化 / M 度量，只有 C、M 有同名预设）；`i18n` 是**机制名**（还绑 i18next），
  与"工具可替换、概念名优先"的取向冲突；而 `i18n = copy` 这种**别名让同一个东西有两个名字** ——
  正是这轮刚清掉的"第二份真相"（`config.layers` / `themeIntegration` / `languages`）。**所以不改名、不加别名。**
- 改成**让后果可见**：`copy({ languages })` 以前**没人读**（语言集合由磁盘扫描得出），
  "声明了 en 却没有 `en/`"完全无声 —— 而缺的那门语言在界面上会直接显示键名。现在 **C07** 增加第二个分支：
  **声明的语言必须有资源**（声明 ⇄ 事实，与 D21 / P11 同一形状）；总资源为零时仍只报一条（不往 C03 灌噪音）。
- 新增夹具 `__fixtures__/copy-langs` → 夹具回归 **27/27**；README 配置模板加了「预设 → 概念」目录；
  DESIGN §5.3 标明"copy = 文案，不是复制"。

### Docs（组合矩阵：96 种穷举实测）

- DESIGN 新增 §7.0.1：3 范式 × 5 域预设全部子集（96 种）**真实加载**的结果 ——
  单范式 + 任意域预设 **96/96 合法**；任取两范式 **3/3 被守卫拦下**；重复写同一预设幂等；
  域预设全开时落点仍随范式（`canonical` → `shared/styles`，`fsd` → `shared/ui/styles`）。
  另记三个"不是错误但要知道"的点：逐键覆盖类字段**顺序敏感**、库范式不声明契约落点（无能力则 skipped 明列）、
  `overrides` 是整体替换而预设之间是并集。

### Added（预设组合语义：范式唯一 + 落点跟范式 + `addRoles` 追加）

- **范式唯一性守卫（fail-closed）**：`presets` 里出现两个范式预设（如 `[canonical(), fsd()]`）→ `loadConfig` 直接报错并指路。
  以前是**静默错误组合**（实测：角色表取后者 36 条、`layout` 逐键混成库范式的空根、`structure` 取并集 → 门禁在量一个不存在的目录）。
- **契约落点改由范式声明**：`canonical()` 声明三根落点、`fsd()` 声明 FSD 落点（`src/shared/ui/styles/…`），
  `designSystem()` **只写用户显式给的路径**（不再塞三根默认值）。于是 `[fsd(), designSystem()]` 开箱就用 FSD 目录，
  以前会被悄悄改回 `src/shared/styles`（实测）。谁都没声明时仍由 `designParams()` 内置默认兜底 —— 与旧版行为一致。
  落点也跟着 `src` 走：`canonical({ src: 'app-src' })` → `app-src/shared/styles`。
- **`addRoles`（追加角色）**：项目在所选规范之外还有自己的目录（`src/legacy/**`）时，
  用 `overrides: { addRoles: [...] }` 追加即可，不必整份重写角色表（那样范式一升级就漂）。`roles` 仍是整体替换。
- 新增 `tests/preset-compose.test.mjs`（4 条）：范式唯一性 · 落点随范式 · 落点随 `src` · `addRoles` 追加与替换的分界。
- 文档：DESIGN 新增 §7.0「预设的组合语义」表（每个字段的合并规则）；PARADIGM §6.6 补一句；ALTERNATIVES §3.5 配方简化为
  `fsd() + designSystem()`（不再手写 6 条路径）。

### Fixed（i18n 落点也跟范式走：`copy()` 不再写死 `src/shared/i18n/locales`）

- `copy()` 以前把 `resourceDir` 写死成 `src/shared/i18n/locales` —— 与 `designSystem()` 塞三根默认值是同一类毛病：
  `canonical({ src: 'app-src' })` 时 i18n 目录**不跟着 src 走**。
- 修法：范式声明 `params.i18nDir`（`canonical()` / `fsd()` → `${src}/shared/i18n/locales`），`copy()` **只写显式给的** `resourceDir`，
  并在 `loadConfig` **一处补齐**（适配器没写就用 `params.i18nDir`）—— 能力判定 / i18n 索引 / 报告都只认一个完整的适配器。
- 库范式不声明 i18n 落点：`[library(), copy()]` 时适配器没有 `resourceDir` → C 域**因能力未声明而停用**（fail-closed 且可见），
  要跑就显式给 `copy({ resourceDir })`。
- 测试：`tests/preset-compose.test.mjs` 增 1 条（三根 / 自定义 `src` / FSD / 显式优先 / 库范式无能力 五种情形）；
  `tests/engine-report.test.mjs` 里那条"默认值"断言改成新语义（默认落点由范式给）。

### Fixed（`fsd()` 默认片段里有两个"按内容命名"的名字）

- 按社区官方 linter 的 [`segments-by-purpose`](https://github.com/feature-sliced/steiger/tree/master/packages/steiger-plugin-fsd/src/segments-by-purpose) 黑名单核对，
  `fsd()` 的默认片段里有**两个不合规**：`shared/assets` 与 `app/providers`（名单里明确列了 `assets` 与 React 的 `providers`）。
  默认值改成合规集 —— shared：`ui/lib/api/config/i18n`；app：`router/styles/i18n`。
- 需要这两个名字就显式加（一行）：`fsd({ sharedSegments: [...默认, 'assets'] })` / `fsd({ appSegments: [...默认, 'providers'] })`；
  这是**有意的摩擦**：默认值不该替项目"洗白"一个会被社区 linter 判为按内容命名的片段。
- 顺带记录一条容易误判的结论：**`styles` 不在黑名单里 → `shared/styles` 合规**（黑名单是穷举式，未列即允许）。
  文档：ALTERNATIVES §3.5 新增「片段名字要过 `segments-by-purpose`」小节（含完整词表与三种写法）。

### Removed（适配器里没人读的 `themeIntegration` 字段）

- **删掉 `uiKit` 适配器的 `themeIntegration` 字段**：它只在 schema 白名单与两个 kit 里出现，**没有任何规则读它**，
  而 DESIGN §7.1 的适配器契约表却写着它驱动 "exclusiveOwner（S03 落点 + D10 边界）" —— 文档在承诺一个不存在的判定。
- 更根本的理由：**第三方覆盖的落点与主题集成文件是项目决定，不是组件库事实**（同一个项目换库不该改变目录）。
  它由 `designSystem({ vendorDir, themeFile, ... })` 与目录规范声明，只有一处真相。
- ⚠️ 破坏性（fail-closed，不静默）：自定义 kit 若还写着 `themeIntegration`，`defineAdapter` 会因未知字段直接报错，
  删掉该字段即可。DESIGN §7.1 表格行与 §7.4 示例同步删除。
- 与 `uiKit()` 的 enable 修复同源：**每条声明都必须有消费者**（`config.layers` 那次的教训）。

### Fixed（`uiKit()` 只给数据不启用规则 → 适配器静默失效）

- **实测的静默失效**：`presets: [fsd(), uiKit(antdKit())]` 时 `.ant-btn` 出现在 vendor 之外**不报** ——
  `uiKit()` 只注册适配器，而读它的 5 条规则（`uiKit.vendorSelectors` → D10/D10b · `uiKit.icons` → P05 ·
  `uiKit.packages` → P11 · `uiKit.detachedApis` → H06）没被任何预设启用（`fsd()`/`library()` 的 enable 是白名单）。
  加上 `designSystem()` 才报 —— 说明这是"谁声明域、谁顺带启用"的偶然，不是设计。
- **修法**：`uiKit()` 声明自己贡献的规则集（与域预设同一套"声明即启用"语义，取并集）；是否真的跑仍由**能力协商**决定。
  修复后同一配置 13 → **18 条规则**，D10 正常报出。
- **新增通用守卫测试**「能力提供者必须启用消费它的规则」：遍历所有带 `requires` 的规则，断言提供该能力的预设
  （`copy()` / `metrics()` / `uiKit()`）确实启用了它 —— 这类"装了适配器却没人读"的漏洞以后会被测试拦住。

### Added（`fsd()` 预设：FSD 从 38 行角色表变成一行）

- 新增 **`fsd()`**：把 Feature-Sliced Design 的三层模型全部落成**数据** ——
  层 → `layer` 层号 · 切片 → `group: 'slice'` · 片段 → **封闭枚举** · 公开面（切片根 `index.ts`）→ `entry: true`；
  三条结构规矩由通用规则判：`structure: { order: true, isolate: ['slice'], publicApi: ['slice'] }` → **S21 / S22 / S23**。
  **引擎里没有一行 FSD 字面量** —— 换范式只是换预设那一行。
- 选项：`src` / `slicedLayers` / `appLayer` / `sharedLayer` / `segments` / `sharedSegments` / `appSegments`，
  以及 `slicesGrouped`（分组切片 `features/auth/login/...`）。**分组必须显式打开**：两种形态无法用一组 glob 同时表达
  （`{group}/{slice}/{seg}` 会把不分组的路径也匹配上 → 角色歧义）。
- **决策反转并记录**：结构声明化之前定的"不内置 FSD 预设"是错的 —— 预设层本来就是**规范的家**（`canonical()` 也是规范），
  让每个宿主手抄 38 行角色表才是重复劳动；引擎的零方法论字面量由 P2/P3 自检保证。
- 夹具 [`__fixtures__/fsd-preset`](./__fixtures__/fsd-preset)：一份完整 FSD 项目（合规文件 + 四类违规）→ 夹具回归 **26/26**；
  预设结构测试进 `tests/presets.test.mjs`。
- 文档：ALTERNATIVES §3.5 改成"FSD 就这么配"（原手写配方收进 `<details>`）；DESIGN §7 预设列表与 PARADIGM §6.6 同步。

### Docs（口径修正：不再把 steiger 当 FSD 的必经之路）

- [ALTERNATIVES.md](./docs/ALTERNATIVES.md) §3.3 加前置说明：结构声明化落地后**我们自己就能表达 FSD**（S21/S22/S23），
  这一节只适用于**已经在用 steiger** 的宿主；新项目走 §3.5 的声明配方即可，不必引入第二个工具。
  （原先"结构归 steiger"的前提是"我们不管目录规范"，该前提已被结构声明化推翻。）

### Changed（层序只剩一套机制：`canonical()` 也走通用规则，S07 删除）

- **`canonical()` 现在声明 `structure: { order: true }`** —— 应用范式的层序改由通用的 **S21** 判定，
  原先 shared 专属的 **S07 删除**（规则 56 → **55**，`__fixtures__/graph` 的两条期望随之改为 S21）。
- **顺带补上一个真实漏洞**：S07 只管 shared 内部，所以 `shared → modules`（低层依赖高层）与 `modules → app`
  这两类向上依赖**以前没人管**；S21 判的是"只许依赖层号 ≤ 自己的文件"，把它们一并抓住。
- **不重复报**：S21 只在 `to.layer > from.layer` 时触发，而 S05/S06（域间，同层）与 S09（layouts → modules，向下）
  都在别的方向上，所以一条边仍只被一条规则报。
- 域与装配层的**关系**（域间只能经 routes、layouts 不许引域、有 views 必有 routes）仍归 S04–S09/S14 ——
  那些不是层序，声明表达不了。
- ⚠️ **迁移提示**：宿主基线里若有 `S07` 条目，会作为「过期条目」被棘轮提示删除（可见，不静默）。

### Added（结构声明化：目录规范变成宿主可声明的数据，S22/S23）

- **`StructureSpec` 三个字段，各有一条规则消费**（不做"声明了没人读"的配置 —— `config.layers` 那次的教训）：
  - `structure.order: true` → **S21 层序单向**（门控从"猜 `layout` 是否为空"改成**读声明**）；
  - `structure.isolate: ['slice']` → **S22 组隔离**：同组维度、同层、不同组之间不许互相引用；
  - `structure.publicApi: ['slice']` → **S23 公开面**：组必须有入口文件，且组外不许直接引用组内非入口文件。
- **组与入口都是角色表里的数据**：`{ pattern: 'src/pages/{slice}/ui/**', layer: 5, group: 'slice' }` 声明组维度，
  `entry: true` 标记入口（三根是 `routes.tsx`、FSD 是 `index.ts`）—— **规则不认识任何具体文件名**，引擎里没有方法论字面量。
- **引擎**：`FileRecord` 新增 `captures`（全部 `{name}` 捕获）/`group`（组值）/`groupName`（维度名）；
  `RoleDescriptor` 新增 `group` / `entry`；`Preset.structure` 与 `overrides.structure` 之间**加法合并**；
  S21–S23 抽到 `src/packs/react/rules/structure-declared.ts`（"声明驱动"一组）。
- **"目录枚举"这个原定缺口被设计消解**：组由文件派生（没文件的目录不构成组），"组缺入口"用文件集就能判 —— 少一处引擎改动。
- **验收**：夹具 `structure-isolate`（S22）与 `structure-public-api`（S23，顺带覆盖 `{slice}` + `{segment}` 多捕获）→ 夹具回归 **25/25**；
  新增单测「同一份引擎换范式」：用 `atoms/molecules/organisms` 三个**声明**层跑 S21，违规必报且**引擎零改动**。
- **文档**：DESIGN 新增 §6.2.1 结构声明、§5.1 加 S22/S23、§7 示例补 `structure`（并修正 `copy` 参数名）；
  PARADIGM 新增 §6.6「结构声明：范式是可换的数据」（含 L1–L3 硬边界）；ALTERNATIVES §8 标为**已实现**；
  规格 `.scratch/structure-as-data/spec.md`（done）。规则总数 54 → **56**。

### Added（S21 分层单向：`library({ modules })` 的层号不再只是声明）

- **新增 `S21`**：只许依赖**层号 ≤ 自己**的文件（`to.layer > from.layer` 即报）。
  它是 `library({ modules: { data: 1, engine: 2 } })` 里那些数字的**唯一用途** ——
  在此之前层号被写进 `record.layer` 却没有任何规则读它（唯一的消费者 S07 是 shared 专属，
  而库范式把 `layout.shared` 置空 → 恒不生效）。实测证据：**把层号倒过来，输出一模一样**。
- **自带一道门**：`layout.modules` / `layout.shared` 非空时（应用范式）直接跳过 ——
  应用范式的层序已由 S07（shared 线性层序）+ S04–S09（域/装配层）负责，不重复报同一条边。
- 哨兵层（`test` = 99）跳过：测试可以引用任何东西，不算"向上依赖"。
- 文档补了「用现有能力定义 FSD」的实测（[ALTERNATIVES.md](./docs/ALTERNATIVES.md) §3.5）：27 条角色描述符能钉住层封闭枚举 + 片段封闭枚举 + 层序；
  同层切片互不引用与公开面定义不了（根因：`{slice}` 捕获被丢 + 缺公开面规则）。
- 新增夹具 `layer-order`（`exact: true`：low(1) 引 high(2) → 恰好一条 S21）+ 门控单测；
  `library()` 的 enable 列表加入 `S21`。

### Fixed（`enable` 取并集 + `disable` 减法：预设组合不再静默关域）

- **`enable` 从"后者覆盖前者"改成"并集"**：多个预设各自声明自己贡献哪几条规则，组合是加法。
  旧行为的真实后果：`library({ modules }) + designSystem() + copy() + deps()` 只启用 **10/53** 条 ——
  D/C/M 域被静默关掉，宿主必须手抄一份 40 个 id 的并集才跑得起来（FSD 配方就是这么被逼出来的）。
- **各域预设补上"贡献声明"**：`designSystem()` → D 12 条 · `copy()` → C 6 条 · `deps()` → P 7 条 ·
  `metrics()` → M 8 条 · `hygiene()` → H06；`canonical()` 显式声明 `enable: 'all'`（应用范式默认全开）。
  并新增守卫测试：每个域预设的 enable 列表必须**等于**该域已实现的规则集，防止"加了规则没挂进预设"。
- **新增 `disable`**（预设与 `overrides` 都取并集）：`enable` 求完之后再减 —— 例如 FSD 宿主想保留具名导出时
  `overrides: { disable: ['S11'] }`。
- `overrides.enable` 语义不变：仍是"我全都要自己定"的整体替换开关。
- 文档同步：[ALTERNATIVES.md](./docs/ALTERNATIVES.md) §3.3 的 FSD 配方去掉了 40 个 id 的并集、§3.4 的阻塞点标为已修；
  PARADIGM §11.1 补上"预设各贡献规则集并取并集"的语义。

### Docs（"兼容所有规范的引擎"先例调研）

- [ALTERNATIVES.md](./docs/ALTERNATIVES.md) §8 补上先例：这类引擎在 **ArchUnit（Java）/ import-linter（Python）/
  go-arch-lint（Go）/ Nx tags（JS monorepo）** 早有成熟实现，且抽象出的都是同一个形状（映射 / 关系 / 层序 / 公开面）——
  也就是 §8 的四个字段。JS/TS 侧只有"半个"（`@boundaries/elements` 99 万/周、`dependency-cruiser` 287 万/周、
  `eslint-plugin-project-structure` 4.9 万/周），`archlint` 已停更。
- 记下硬边界与可验收定义：**只能兼容规范的可判定部分（L1–L3）**；验收 = 同一份引擎用三份声明表达
  三根 / FSD / Atomic Design 且夹具各自通过、引擎零改动。

### Docs（steiger + 我们的实测配方）

- [ALTERNATIVES.md](./docs/ALTERNATIVES.md) §3.3/§3.4 换成**实测通过的配置**：依赖安装（npm 只装 steiger；pnpm 必须显式装
  `@feature-sliced/steiger-plugin`）、`steiger.config.mjs`（`.js` 且无 `type: module` 会报 `Failed to load the ES module`）、
  我们这侧的 `library({ modules: 六层, entry: [] })` + 契约预设 + `disable: ['S21']`。
- 记录一条方法论纠正：**steiger 在场时不要用 27 条细粒度角色表**（会与 `segments-by-purpose` / `public-api` 重复报），
  粗粒度六层足够 —— 我们只兜"层外文件"与跨文件契约。
- 实测分工：steiger 14 条（层序/跨切片/公开面/死切片/片段命名）vs 我们 10 条（层外文件 + 死令牌 + 文案 + 依赖），**零重叠**；
  其中 `src/utils.ts`（层外文件）**steiger 零命中**，只有 S01 抓得住。

### Added（`docs/ALTERNATIVES.md`：替代组合与竞品盘点）

- 新增一份整体版生态审计（[ECOSYSTEM-AUDIT](./docs/ECOSYSTEM-AUDIT.md) 的补充）：
  逐条列出我们的判据在生态里谁在做（含周下载量）、**拼一套成熟组合能覆盖 ≈30/53 条**、
  以及**任何组合都补不上的七项**（跨文件令牌图 / 跨语言一致 / 声明⇄事实 / 依赖选型体系 / 统一棘轮 / 判定纪律 / CSS Module 契约）。
- 收录实测证据：steiger 在非 FSD 项目上给 **`✔ No problems found!`（静默假绿，退出码 0）**，同一个工具在 FSD 项目上报 10 条；
  eslint 的 suppressions 是 `文件+规则→计数`（**按计数不按行**，修一处可在别处加一处），与我们的行文本锚点形成实质差别。
- 收录 FSD 场景的完整配方（路径约定表、`steiger.config.js`、`library({ modules: 六层, entry: [] })` + 契约预设、四个坑），
  以及「结构声明化」方向草案（`structure: { order, isolate, publicApi, slots }` + 四条方法无关的通用规则）。
- 已知阻塞点也写进去了：**`enable` 是覆盖不是并集** —— 不写并集时 `library()` 的白名单会把 D/C/M 域静默关掉（实测 10/53）。

### Changed（依赖政策：P1 从"零依赖洁癖"改成"审查门"）

- **"整目录可搬"不再是发布形态**（本包以 npm 包发布），所以 P1 的理由改成真实的那个：
  门禁读全量源码、跑在 CI —— **新增依赖要有理由，且不得把宿主拖进版本冲突**。
  要加依赖：改 `ALLOWED_BARE_IMPORTS` + `package.json` + CHANGELOG，P1 的报错话术同步改成「依赖没登记」。
- **P2 / P3 保留**，但把理由写对：它们与发布方式无关 —— P2 是「换宿主不改引擎」，P3 是「引擎不假设布局」
  （`canonical` / `library` / 自定义目录全靠它，今天刚靠它抓到 `rootsOf` 写死 `src/modules` 的假绿）。
- README「本体自包含（可抽取）」→「**引擎不绑宿主**」；`CONTEXT.md`、`DESIGN` §0/§6.1.1/§7.1/§7.4 的措辞同步校正。

### Fixed（`globToRegExp` 花括号里的点号没转义）

- `{index.ts,cli.ts}` 会被编译成 `(?:index.ts|cli.ts)` —— 里面的 `.` 是**任意字符**，
  能匹配到 `indexXts`。现在花括号分支逐个转义正则元字符（`{ts,tsx}` 这类无点号的写法不受影响），并加测试锁住。
  之前 `library()` 的入口就是绕开了这个写法才没踩到。

### Added（oxc spike：结论是**不换 parser**）

- 量了（[.scratch/oxc-spike/](./.scratch/oxc-spike/spec.md)，脚本可重跑）：真实规模 3044 文件 / 9.8 MB 下，
  `oxc.parseSync` 比 `ts.createSourceFile` 快 **2.2×**（511ms vs 1133ms）—— 但**解析只占 extractFacts 的 32%**，
  换 parser 的端到端上界只有 **≈17%**；26k 小文件上更是 **≈1%**（每文件开销主导）。
- **真正的大头是我们自己的访问器 + 注释扫描（2.4s / 3.6s = 67%）**，换 parser 还要把这段在 oxc 的 AST 上重写一遍，
  外加 native 多平台二进制与缓存键变更。所以 `DESIGN` §6.1.1 的 oxc 行改成「可再评估」并指向 spike 结论。
- 力气挪到自有代码：注释扫描按需、`containsJsx` 自底向上标记、主循环按 `node.kind` 分派（见 spike 的「下一步」）。

### Changed（canonical 对齐：删死配置、提示指路、跨域组合拍板）

- **删掉 `layers`**（`Preset.layers` / `Config.layers` / `canonical()` 里那 12 行）：全仓没有任何规则读它 ——
  S07 用的是角色描述符上的 `record.layer`。留着就是第二个层号真相 + 一个没人读的配置面。
- **删掉 DESIGN §7 示例里的 `semanticSlots`**：消费它的 D20 从未实现，示例却把它写得像可用配置。
- **S01 / S03 的提示改成「指路」**：按文件位置直接念出落点表 —— `app/providers.tsx` → 「装配套壳写进 App.tsx，
  配置对象下沉 shared/」，`modules/<域>/types.ts` → 「域根只放 routes.tsx，类型与常量进 model/」，
  没登记的槽位 → 念出域内七个槽位，`shared/components/Button.tsx` → 「进 ui/ 或 common/」。
  闭集枚举只说"你错了"没用，迁移中的人（或 agent）要知道"放哪"。
- **R1 拍板（方案 c）**：跨域组合一律**提升**到 `shared/components/common`（业务中立组合件）或
  `shared/api`（数据契约），由 `app` 层组合；域间直连继续红（S04–S06）。
  被否的替代：给域开第二个公开面 `index.ts` —— 深模块会变成两个出口。已写进 PARADIGM §6.3，DESIGN §14 的 R1 标为已拍板。

### Fixed（layout 是唯一真相：自定义目录不再假绿）

- **`canonical({ modules, shared })` 之前是假旋钮**：角色表跟着参数变了（S01 不再报"无处安放"），
  但 S04–S09 / S15 / S18 / S03 还写死查 `${srcRoot}/modules` 与 `${srcRoot}/shared` ——
  查一个不存在的目录 → 静默空转 → 跨域引用私有 views **一条都不报**，门禁显示"通过"。
  实测 A/B：同一份违规，目录叫 `src/modules` 报 S05+S06，配置成 `src/features` 时零报告。
  现在这四处（`structure-graph.ts` 的 `rootsOf`、`structure.ts` 的 S03 / S01 域根豁免）一律读 `config.layout`。
- 新增夹具 `canonical-layout`（`exact: true`）：自定义 `modules: 'src/features'` 下，跨域引用必须报 S04/S05/S06。

### Changed（`library()` 变成真正通用的库范式）

- **角色表参数化**：`library({ modules: { utils: 1, core: 2 }, entry: ['index.ts'] })` ——
  库的结构就是「公开面入口 + 项目自己声明的目录表」。旧版把**本体的目录名写死**在预设里
  （`engine/` `packs/` `presets/` `data/`、入口写死 `cli.ts`、ignore 里一串宿主文件），
  任何第三方库用它都会得到一片 S01（实测：普通库的 `src/utils/`、`src/core/`、`src/types.ts` 全报）。
- **`layout.modules` / `.shared` 置空**表示「库没有域与共享层这两个应用概念」——
  依赖它们的图规则因此自然空转，而不是去查一个不存在的目录假装检查过。
- 内部目录角色**不设 `slot`**：目录名恰好叫 `lib` / `hooks` 时不会误套应用范式的槽位语义（S12/S13 会误判）。
- 宿主专有的 ignore（`es/**`、`examples/**`、`__fixtures__/**`、`pagoda.config.mjs` …）从预设移出，
  本仓库在 `arch.config.mjs` 里显式声明 —— `ignore`（别碰）与 `include`（不判契约但仍解析）是两件事，
  只靠 `include` 会让这些文件照样被解析（实测狗粮 71 → 340 个文件）。
- 新增夹具 `library-generic`（`exact: true`）：一个普通第三方库形态的 `src/index.ts` + `src/utils/` + `src/core/`，零发现项。

### Added（P11：组件库适配表声明了却零使用）

- **`P11`**：声明了 `uiKit(antdKit())`，但项目里既没 import 它声明的任何包、也没有任何 vendor 选择器/变量
  → warn。此时 D10 / D10b / P05 / H06 全在空转，门禁却显示"通过"。
  与 P04 的分工：**P04 管「声明了要装、装了要登记」（清单一致性，error）；P11 管「装了要真的用得上」（事实存在性，warn）**。
  `uiKit(none())`（`packages: []`）能力不存在 → 规则不注册，不会给不用组件库的项目添噪音。
- `declared-gap` 夹具扩成三面齐活：`copy()` 零资源 + `designSystem()` 零路径 + `uiKit()` 零使用 → 恰好三条 warn。

### Added（C07 / D21：声明了能力面却零事实，不再静默空转）

- **`C07`**：加了 `copy()` 但 `resourceDir` 下一个文案文件都没有 → warn。
  能力协商只保证「**没声明**就不注册」；声明了却没有对应事实时，C02–C06 会安静地遍历空集合、
  门禁显示"通过" —— 这正是「以为在跑、其实没跑」。
- **`D21`**：加了 `designSystem()` 但 `paletteFile` / `tokenDir` 零匹配 → warn。
  靠 `params.designSystemDeclared` 显式标记把「没声明设计系统」（应当安静）与「声明的路径写歪了」
  （必须报）分开 —— `designParams()` 带内置默认路径，光看参数分不出来。
- 新增夹具 `declared-gap`（`exact: true`）：两处路径都指空，恰好两条 warn。
- 顺带澄清：**`P03` / `P08` 按 DESIGN §4.9 委派给 knip · depcheck，本体不实现** ——
  `__fixtures__/deps` 的 `enable` 里还点着它们、README 与 DESIGN §16.5 说它们"已落地"，都已改正。

### Fixed（`designSystem()` 的配置根本没生效）

- **`designParams()` 只展开 `DEFAULTS`，从未把宿主的参数盖上去**，于是 `tokenPrefix` / `spacing` /
  `styleDir` / `tokenDir` / `vendorDir` / `paletteFile` / `themeFile` / `storageFile` 八个字段的配置
  **全部被静默忽略**：D03 这类规则照默认路径找不到文件，就静默 `return []`，门禁还显示"通过"。
  现在逐字段解析（可配清单在代码里可见），并把不相关的 `params` 键挡在 `DesignParams` 之外。
  这是 D21 能报出正确路径的前提。

### Added（facts 持久缓存：重复运行 ≈5×）

- 新增 `src/engine/facts-cache.ts`：把每个文件的解析结果（facts）按 **rel + role + 内容 sha1** 缓存到磁盘，
  下一轮没变的文件直接读缓存、不再解析。整份缓存的键是 `FACTS_CACHE_SPEC` + TypeScript 版本 ——
  事实模型或解析器换了就整体作废。图与全局谓词**不在缓存里**，每轮照旧从 facts 重建（保住「scope 只过滤报告」的语义）。
- **实测**（3043 个 ts 文件 / 21.5 万行）：冷跑 5.88s → 热跑 **1.22s（4.8×）**；
  26k 个**小**文件仓库 4.0s → 3.1s（−23%，文件越小解析越便宜，缓存能省的自然越少）。
- **缓存写在哪**：跟 Vite 同一策略 —— 有 `node_modules` 就写 `node_modules/.arch-guard-cache/facts.json.gz`
  （天然被 git 忽略、`rm -rf node_modules` 顺手带走），没有 `node_modules`（PnP / monorepo 子包）则退回项目根 `.arch-guard-cache/`。
- 每次运行自述**命中数与路径**；`--no-cache` 关掉；缓存损坏 / 版本不符 → 整份作废并说明原因；
  写不进去（只读盘、权限）只提示、不影响判定 —— 缓存是加速手段，不是正确性依赖。
- 7 条测试锁住：全命中、**改内容必重算（防假绿）**、role 变化重算、损坏与版本不符作废、
  `--no-cache`、`node_modules` 位置、落盘内容带 spec + ts 版本。

### Changed（框架包接进配置：规则集不再硬编码）

- **`arch.config.mjs` 支持 `packs: [reactPack]`**：规则集由框架包给出，`cli.ts` 不再硬编码 `reactRules`，
  只提供**兜底包**（引擎不认识任何 pack —— 依赖方向是 pack → 引擎）。
- **`Pack` 新增必填 `framework`**：它实现哪个元框架。于是 `metaFramework` 与 pack 不再可能各写一份：
  配了包就以包为准；两边都写且不一致直接报错。这消掉了上一版刚引入的「两处真相」。
- **一个项目只允许一个包**：换元框架是换 parser 与整套规则集，不是叠加；多包直接报错并指向 DESIGN §7.5。
- **没有任何包又没有 rules 时明确报错**，而不是「跑 0 条规则 → ✔ 通过」。
- `runGuard` 的 `rules` 变为可选（程序化调用/单测显式给规则集的路径不变），新增 `fallbackPacks`。

### Added（`metaFramework` + S20：非 React 项目不再假绿）

- **新增配置轴 `metaFramework`**（默认 `react`），取值表在 `src/data/framework-sources.ts`（纯数据，引擎里不出现框架名）。
  认不出的取值、或**还没有 pack** 的框架（`vue` / `svelte` / `astro`）一律 fail-closed 报错。
- **为什么这是红线**：`.vue` / `.svelte` 本来根本不在扫描扩展名里（`walk` 只收 ts/tsx/js/jsx/mjs/cjs + css/scss/less + json/html），
  于是拿 Vue 项目跑会得到「扫到 0 个文件 → **✔ 架构守卫通过**」—— 一行都没查还说通过了，正是本工具最反对的假绿。
- **新增规则 `S20`（框架包必须覆盖项目的源码形态）**：项目里混进当前 pack 量不了的源码即报，
  并列出 `扩展名 × 个数`。这些文件不会混进文件集参与图判定。
- 新增夹具 `framework-gap`（`exact: true`：一个 canonical 工程 + 一个 `.vue` 页面 → 恰好一条 S20）。
- 顺手补回 `__fixtures__/clean/src/shared/lib/format.ts`：`clean` 夹具的 `CrewsPage.tsx` 一直在 import 它，
  但文件同样被 `.gitignore` 吞掉，留下一个悬空引用（不报错、所以没人发现）。

### Added（S19 导出宽度与单文件组件数）

- **新增 `S19`**：单文件导出值 > `exportsPerFile`（默认 6）或单文件组件数 > `componentsPerFile`（默认 3）即报。
  「导出值」不计类型导出（类型是契约，不是宽度）。
- **只属于应用范式**：`canonical()` 默认开（`enable: 'all'`）；`library()` 的启用名单里没有它 ——
  库的入口 `src/index.ts` 就是公开面，导出几十个符号是正确形态（实测：按 error 直接落到库里会先把狗粮自己打红 9 个文件）。
  这是 ADR-0003「规则集必须跟着工程类型走」的又一次应用。
- 新增夹具 `width`（`exact: true`）：`shared/lib/many.ts` 7 个导出值、`shared/components/ui/Multi.tsx` 4 个组件，
  两个文件都接进可达图以免顺带触发 S15。
- 顺手修文档漂移：`DESIGN.md` §5.1 那句「已实现并带夹具的规则：…H01–H05」早已不准，
  改为以 `reactRules` 为准的 49 条清单，并写明 `S08` / `S10` / `P03` / `P08` 是**委派**而非漏实现。

### Changed（删掉没人读的配置旋钮）

- **删掉 `naming.pageComponentSuffix`**：全仓 grep 没有任何规则读它（`hookPrefix` / `viewSuffix` 有），
  属于「以为在管、其实没管」的假旋钮。`Thresholds.exportsPerFile` / `componentsPerFile` 这次补上了实现（见 S19）。

### Changed（范式补一条：全局 Provider 装配放哪）

- `PARADIGM.md` §6.4 唯一落点表新增两行，并把 React 习惯的 `app/providers.tsx` 写进反例表：
  **套壳写进 `app/App.tsx`，provider 的配置对象各自回家**（queryClient→`shared/api`、theme→`shared/theme`、
  i18n→`shared/i18n`、store→`shared/stores`）。
  不为此给角色表开通用口子 —— app 层仍是封闭枚举，`App.tsx` 只留几十行嵌套，也撞不到 S16 的 500 行。

### Added（契约扫描域 `include`）· 行为变更

- **新增 `include`**（配置根相对的 glob 列表，[规格](./.scratch/include-scope/spec.md)）：只有命中它的 ts/css 参与角色判定与逐文件规则。
  域外的 `vite.config.ts` / `e2e/` / `scripts/` / 生成代码**不再被报「不在目录契约内」**。
  实测把 2 万个生成文件放进项目：**20000 条 error → 0**。
- **`canonical()` / `library()` 默认 `include = [<srcRoot>/**]`**（行为变更：域外文件不再进 `missing`）。
  `overrides.include` 可覆盖，空数组 = 不限制（引擎默认）。报告摘要与 notice 会自述扫描域与域外文件数，不静默。
- 域外文件**照常解析**（角色记为 `(outside)`）：import 边与「测试是独立可达根」都靠 facts，
  少了它们，只被域外测试引用的 src 文件会被误判成孤儿（S15）。这条是夹具当场抓出来的。
- `M08`（该有测试的文件）改从**完整文件集**找测试文件：测试常放在契约域之外（`tests/`），
  它们没有角色、不进 `records`，但「有没有测试」必须看得见。
- 新增夹具 `include-scope`（默认域外不报，`exact: true` 锁零发现项）与 `include-custom`（`overrides.include` 把 `scripts/**` 纳回契约 → 重新报 S01）。

### Changed（性能：解析热路径瘦身，实测 −20%）

基准：`canonical() + hygiene()` 合成宿主，3043 个 ts 文件 / 21.5 万行，全量运行。

- **`createSourceFile` 改用 `setParentNodes: false`**（`docs/DESIGN.md` §6.1.1 本来就写的是 false，代码写成了 true）。
  只有 3 处需要父节点（字符串字面量的上下文、`prop` 名、箭头函数的变量名），改为在遍历时**显式传参**，
  不再让 TS 给每个节点都挂父指针。累计 **5.75s → 4.63s**。
- **删掉 5 组零消费者的 facts 字段**：`jsxText` / `catches` / `inlineStyles` / `anyNodes` / `nonNull`。
  对应的 H01（`any` / 非空断言）、H05（空 catch）、D15（内联样式）、C01（JSX 裸文本）早已
  [委派给 eslint 并从规则集删除](./docs/ECOSYSTEM-AUDIT.md)，收集代码却留了下来 —— 每次全量解析都在为没人读的字段付钱。
  `Facts` 类型与 `__fixtures__` 的断言同步收缩，并在 `extractFacts` 上写明「加字段前先确认有规则在读」。
- 两部分合计 **5.75s → 4.63s（−20%）**，峰值内存 277MB → 264MB。

### 补齐的夹具（曾被 `.gitignore` 吞掉，按 `expect.json` 的期望重建）

`violations` / `adapters` / `graph` / `hygiene-context` / `rules` / `coverage` 六组共 14 个文件：

| 夹具              | 补回的文件                                                    | 触发的规则      |
| ----------------- | ------------------------------------------------------------- | --------------- |
| `violations`      | `src/shared/lib/helpers.ts`（barrel + default 导出 + 孤儿）   | S11 / S13 / S15 |
| `adapters`        | `src/shared/lib/helpers.ts`（弱指纹 + `debounce` 命名指纹）   | P07 / S15       |
| `graph`           | `format.ts`（lib 反向依赖 api）、`leftover.ts`、`crewOnly.ts` | S07 / S15 / S18 |
| `hygiene-context` | `datetime.ts`、`fixtures.ts`、`timers.ts`（孤儿）             | S15             |
| `rules`           | `big.ts`（49 行 > 夹具阈值 40）                               | S16             |
| `coverage`        | `good.ts`、`bad.ts`、`zero.ts`                                | M02 / M03 / M08 |

> 这些文件是**按 `expect.json` 的期望反推重建**的，不是原作者的原始内容；原作者若手上有原件，可以直接覆盖比对。

## [0.2.3] - 2026-09-23

### Changed（依赖策略：能力表不再隐式开启 P01）· 行为变更

- **`deps({ capabilities })` 不再顺带打开 `P01` 依赖白名单**（[ADR-0005](./docs/adr/0005-allowlist-is-explicit.md)）。
  旧实现 `approved = allow ∪ capabilities.values` 以 `approved.size` 判空，于是「只限定日期格式化用 dayjs」
  写成 `deps({ capabilities: { datetime: 'dayjs' } })` 等价于宣布「批准清单里只有 dayjs」——其余运行时依赖全部报红。
  现在 `P01` 的开关是 `allow` 是否显式声明，能力表只驱动 `P06`。反重复不受影响：`policyConflicts` 仍要求
  `allow` 非空时能力首选必须登记在 `allow` 里。
- **批准名单的组成 = `allow ∪ 适配表声明的 packages`**：`uiKit(antdKit())` 这类适配器已经声明了「项目用什么库」
  （P04 读同一份数据），组件库不必在 `allow` 里重抄。适配表只**并入名单**，不打开 `P01` —— 开关仍然只有 `allow`。
- 不静默：`runGuard` 在「有 capabilities、无 allow」时打印 notice，说明 P01 未开启、如何显式开启。
  配置格式未变，故未 bump `CONFIG_SPEC_VERSION`。
- 夹具 `__fixtures__/declarations-only` 锁住「只写声明不开 P01（P06 必报 × P01 不报）」，
  `__fixtures__/allowlist-adapters` 锁住「适配表的包被批准（`exact: true`，多一条即失败）」。

## [0.2.2] - 2026-09-23

### Fixed（第三轮：审计修正）

- **`C02` / `C06` 恢复实现**：`t()` 的键存在性与死键检查回到本体，0.2.0 里「删除 `C02`（键存在）、`C06`（死键）」
  那一条随之作废。删除理由写的是「`eslint-plugin-i18next` 能覆盖」，但实测该插件只有 `no-literal-string`
  一条规则（`Object.keys(plugin.rules)`），`no-missing-keys` / `no-unused-keys` 根本不存在 ——
  于是键拼错（界面直接显示键名）与死键成了没人守的两件事。
- 文档同步更正：`docs/ECOSYSTEM-AUDIT.md` §1 / §4（补一行 C02 / C06 的交叉判定）、
  `docs/DESIGN.md` §4.9（C01 的委派对象只有 `no-literal-string`）与 §14（D / C 域的落地状态）。
- `library()` 预设去掉指向已删除规则的 `H02`，自身 `pnpm guard:self` 不再报「配置里启用了不存在的规则」。
- 规则总数 46 → **48**（C02 / C06 回归）；0.2.0 里几处「精简到 42 / 44 条」是更早的旧账，实际以 `--stats` 为准。

## [0.2.1] - 2026-09-23

### Fixed

- **`--paths` 接受绝对路径**（IDE / 编辑器插件按文件传参的形态）：之前只按配置根相对路径匹配，
  诊断工具传绝对路径时一条都匹配不上 → 门禁报「通过」但其实什么都没查（静默假绿）。
  新增 `rootRelativePattern()`：绝对路径 / 绝对 glob 归一到配置根相对（含 `/var` ↔ `/private/var` 软链写法差异），
  相对模式原样。
- **`--paths` 过滤掉全局违规时给出 notice**：`另有 N 条全局违规（架构级）被过滤，需全量运行才可见` ——
  否则「按文件跑」会让人以为架构级谓词也过了。

## [0.2.0] - 2026-09-23

### Added

- **design 域 12 条规则（D01–D11 + D10b）**：颜色唯一出处、色板只放色板令牌、色值唯一、令牌引用闭合、
  无死令牌、明暗双份齐全、对比度基线（WCAG + 半透明合成）、storage key 与 index.html 一致、禁 `!important`、
  组件库选择器只许在 vendor、vendor 目录反向封闭、无框架残留。
- **copy 域 C02–C06**：文案键必须存在、多语言键一致、一文件一命名空间、分片必须被聚合入口引用、无死键（warn）。
  C01（JSX 裸文案）委派给 `eslint-plugin-i18next` 的 `no-literal-string`。
- **CSS 结构化解析器**（`src/engine/css.ts`）：注释遮罩、块与选择器、自定义属性定义/引用、颜色求值与对比度。
- **i18n 资源索引**（`src/engine/i18n.ts`）：用 TS 解析器把 `locales/<lang>/<ns>.ts` 解析成键路径。
- `copy()` 预设改以 **i18n 适配器**声明能力（`requires: ['i18n.resourceDir']`），未声明时规则出现在 `skipped` 而不是静默失能。
- `CallFact` 增加 `stringArg` / `keyPrefix`（动态键 `t(\`ns.${x}\`)` 按静态前缀放行死键判定）。

- **structure 域补齐 S03–S09/S15/S17/S18**：域根只许 routes、域内 import 前缀白名单、跨域只经 routes、
  views 域外私有、shared 线性层序、全图无环、layouts 不 import modules、可达性三查（孤儿/routes 聚合/view 引用）、
  导出名查重、shared 单域使用。
- **design 域补齐 D12–D18**：魔法长度/层级/时长、内联样式纪律、样式落点、CSS Module 双向契约、只消费语义令牌。
- **deps 域补齐 P04/P05/P07**：适配表与实际依赖一致、图标来源唯一、弱指纹+命名指纹的疑似自造轮子。
- **hygiene 域补齐 H06–H10**：脱离上下文的全局 API、假异步与随机、硬编码地址、静默假数据、手搓时间格式化。
- **S02 目录深度上限可配**（`params.maxDepth`，默认 4）：范式自身的 `locales/<lang>/<ns>.ts` 就是 4 层，写死会误伤。
- CLI/扩展：`--format=github`（CI 注解）、`--stats`（规则耗时与命中）、`--verify-deps`（适配表对账）、
  `definePack()`（包定义契约）、config/baseline 的 `specVersion` 校验。
- **修复：根 tsconfig 只有 `references` 时别名解析失败**（Vite 官方模板形态）→ 图解析全空，
  S15 会把整个项目误报成孤儿、图规则集体失明。现在顺着 references 链取 `paths`。

### 审计：与 lint 生态的交叉（第二轮）

- 新增 `docs/ECOSYSTEM-AUDIT.md`：逐条判定 44 条规则的交叉情况（真独有 / 需重抄项目数据 / 与运行器阈值部分重叠），
  并给出可复现的核查命令（`npx oxlint --rules`、`builtinRules.has(...)`）。
- 按审计结论再删 4 条零数据重复：`H02`（→ `eslint-plugin-eslint-comments`）、`D15`（→ `no-magic-numbers` + 选择器）、
  `D02`/`D18`（→ stylelint）。
- 新增 **M 度量域**（M02/M03/M04/M06/M07）：读覆盖率产物与依赖计数，**门禁不跑测试**；
  `M06` 在产物缺失/过期时 fail-closed（这是没有工具做的那一环）。总阈值 M01 与体积预算 M08 故意不实现（vitest 阈值 / size-limit 已有）。
- 新增两条**测试治理**规则（现成工具没有的）：`M08` 测试↔源配对（静态判定「该有测试的地方有没有测试」）、
  `M09` 门禁链路自检（`check` 必须真的包含 test 与 coverage —— 本会话踩过的「覆盖率在跑但统计错了对象」）。
  测试专项审计见 `docs/ECOSYSTEM-AUDIT.md` §4.1。
- 引擎：`run.ts` 提前计算 scope 供 M05 复用、`ctx.metrics`/`ctx.git` 接入、`--coverage-report` 开关、
  `--update-baseline` 同时写覆盖率棘轮快照。

### Changed

- **从 62 条精简到 42 条**：把「重新实现 lint 已有能力」的规则全部删掉，并写清委派去处
  （`docs/DESIGN.md` §4.9 委派清单）。
  - 删除：`H01`（any/非空断言/ts 注释）、`H03`（console/debugger/alert）、`H04`（TODO）、`H05`（空 catch）、
    `H07`（假异步/随机）、`H08`（硬编码地址）、`H09`（假数据）、`S08`（依赖环）、`S10`（`../` 越级）、
    `P03`（幽灵依赖）、`P08`（登记未使用）、`D01`（颜色字面量）、`D09`（`!important`）、
    `D12/D13/D14`（魔法数字三族）、`C01`（裸文案）、`C02`（键存在）、`C06`（死键）。
  - 收窄：`S15` 去掉孤儿维度（交 dependency-cruiser）、`S16` 去掉行数维度（交 eslint max-lines）。
  - 保留的都是需要「角色表 / 适配器 / 能力表」的：角色表互斥完备、域边界与层序、路由聚合与 view 引用、
    令牌图与对比度、CSS Module 双向契约、多语言同构、能力指纹、批准清单策略等。
- **迁移约束到 lint**：本仓 `eslint.config.mjs` 承接 `no-empty`、`no-warning-comments`、
  `max-lines`(500)、`max-lines-per-function`(300)、以及原有的 any/非空断言/ts 注释/console；
  README 首段改为明确分工（本工具不是 linter）。
- **D 域在 superhive 实测与旧 `check-theme` 结论一致**（0 条），旧脚本标记 `@deprecated` 并写明退役条件。
- `designSystem()` 的对比度基线默认**留空**：token 名是项目专有数据，预设不替项目做决定。

### Fixed

- **`--scope=changed/staged` 在软链路径下会假绿**：变更路径换算没做 realpath，macOS 的 `/var`↔`/private/var`
  （以及任何软链）会让路径与文件对不上，`active` 直接变空 —— 增量门禁将永远通过。现在两侧先 realpath。
- **CLI 通过软链路径调用时静默什么都不做**：直接调用判定用字面路径比较，`/tmp`→`/private/tmp` 之类会不相等，
  于是 CLI 打印空、退出 0（比报错更糟）。改为 realpath 比较。
- **`loadBaseline` 把 specVersion 错误吞成「基线文件无法解析」**：版本检查移出 try，报错才可执行。
- `i18n` 计算属性名（`[key]`）带方括号；`ts-api` 的版本读取改为可注入（异常分支可测）。
- **基线同一行多条违规无法全部豁免**：`applyBaseline` 用消耗式匹配（`splice`），同一行上的第二条违规
  （例如 `style={{ flex: 1, minWidth: 0 }}` 报出的两条 D15）永远豁免不了，棘轮会一直在那几行报红。
  改为「按锚点匹配 + 标记已用」：锚点标识的是**行**，该行的所有违规一起豁免。
- `normalizeHex('#FFF')` 不展开缩写（没剥 `#`）；`color-mix` 只接受 `var()` 底，十六进制底解析不了。
- CSS 选择器与声明的行号系统性少 1（缓冲起点落在上一行结尾的换行上）。

### Tests

- 测试 69 → **88 项**，覆盖率 94.4%/87.8% → **97.64% 行 / 88.43% 分支 / 98.31% 函数**。
- 新增：`css`（解析器/颜色求值/对比度）、`i18n`（键路径与命名空间前缀）、`deps-audit`（适配表对账）、
  `cli-extra`（`--verify-deps`/`--format=github`/`--stats`/错误参数退出码）、`output`、
  以及把**夹具回归搬进测试进程**（此前 `pnpm coverage` 只跑单测，新规则的函数覆盖率显示为 0%）。
- 测试 88 → **112 项**，覆盖率 → **98.84% 行 / 93.61% 分支 / 98.09% 函数**（无文件低于 90% 行）。
- 新增：预设参数分支、规则空项目健壮性（62 条全部安静通过）、规则早退分支、引擎边界
  （tsconfig references、baseUrl、损坏基线、git scope 三种模式、CLI 失败分支）。
- **测试缝**：`run(argv, { packageRoot })` 与 `createProgram(version)` 可注入，CLI 失败分支得以同进程覆盖
  （spawn 子进程的执行不会被父进程覆盖率统计合并）。

### Fixed

- **没有 git 时不再把 git 自己的报错透传到用户屏幕**（`致命错误：不是 git 仓库…`）：`execFileSync` 的 stderr 默认透传，
  而三处 git 调用本来就 `catch` 掉走「明确降级」分支。改为 `stdio: ['ignore','pipe','ignore']`；
  另外 `headTimeMs`（只有 M06 会读）改成**配了 metrics 适配器才算**，没配就不起子进程。
  测试输出里的该类噪音 14 处 → 0。
- **`.gitignore` 的 `lib/` / `es/` 未锚定仓库根**，把 `__fixtures__/*/src/shared/lib/**` 一并吞掉：
  夹具文件从来没进过 git，干净克隆下 6 个夹具缺文件、自检与 2 个测试恒失败。已改为 `/lib/` `/es/`，
  并**补齐了全部 14 个缺失文件**（见下）。`pnpm self-test` 恢复 **17/17**，测试 **131 通过 / 0 失败**。
- **`M02` 的发现项改用配置根相对路径**（原来是覆盖率产物的绝对路径 `report.path`，与 M06 不一致）：
  绝对路径写进报告与棘轮基线后，换机器/换 CI 必然对不上 —— 这是真·假红来源。
  夹具里那两处机器相关数据（`coverage-summary.json` 的键、`expect.json` 里 M02 的 `file`）同步改成相对路径。
- `tests/fixtures.test.mjs` 读的是不存在的 `item.reason`（`runSelfTest` 给的字段是 `message`），
  导致夹具失败原因一直打印成 `undefined` —— 夹具回归红的时候看不见为什么红。

## [0.1.4] - 2026-09-23

### Fixed

- **superhive 首次接入暴露的 3 个误报**：`S12` 不再管 views 下的样式文件与 api 的 camelCase、
  `S13` 放行 hook 的类型导出、`S14` 定位点优先取代码文件。
- **`S14` 定位点改为首个代码文件**：原来随文件遍历顺序漂移，同一违规的棘轮锚点会不稳定。

## [0.1.3] - 2026-09-23

### Fixed

- **`dependencies.commander` 被字段重排脚本吃掉**：由 CI 的 `frozen-lockfile` 拦下；
  补 manifest 防呆测试（`tests/engine-runtime.test.mjs`）—— 运行时依赖少一个，发布的包直接不可用。

### Changed

- **删除 GitHub 托管 CI**（`.github/workflows/ci.yml`）：门禁改为本地 `pnpm check`（谁提交谁在本地跑），
  `AGENTS.md` / `README.md` 同步说明。此前的 CI 迭代（矩阵 `fail-fast: false` + 超时 + 失败注解）随之移除。
- 补 `repository` / `homepage` / `bugs` 元数据；忽略并取消跟踪 npm pack 产物
  （`.gitignore` 只对新文件生效，已跟踪的 `.tgz` 要显式移除）。

## [0.1.0] - 2026-09-23

### Added

- **测试补齐到 94% 行覆盖**（起点 83%）：新增 `tests/engine-{unit,facts,graph,runtime,report}.test.mjs`（纯函数 / 事实模型 / 依赖图 / 配置 / 报告 / run 路径 / CLI），并把「每条已实现规则必须有违规夹具」写成契约测试。`pnpm coverage` 用 Node 内置覆盖率。
- **新增 `__fixtures__/rules`**：补上此前无夹具的 S02（目录深度）、S16（体积）、H02（suppression）、H05（空 catch），以及 H01（非空断言 / `@ts-expect-error`）、H03（debugger / alert）、H04（占位字符串）、S12/S13（hooks / model 导出形态）的缺失分支。
- **引擎骨架（P0）**：配置加载（预设合并 + tsconfig 别名单一出处）、目录扫描与角色表（互斥完备自检）、TS 事实模型（parser-only，规则不接触 AST）、import 图（含动态 import 与 CSS `@import`/`composes`）、能力协商注册表、棘轮基线（行文本哈希锚点）、报告（pretty / json）、检测范围 scope（full / changed / staged / since）。
- **规则**：结构域 S00–S16（解析失败 fail-closed、目录契约、深度、相对越级、barrel、命名、导出形态、域路由必填、体积），反退化域 H01–H05（类型逃生舱、suppression、调试残留、未完成标记、吞异常）；共 14 条。
- **依赖域规则（P01/P02/P03/P06/P08）落地**：登记白名单（fail-closed）、禁用库、幽灵依赖（排除 Node 内置）、能力必须用登记方案（强指纹 + 全项目 import 判定 + 平台内置识别 + `allowOwn` 降级）、登记方案未被使用。指纹匹配前遮罩注释；无 `package.json` 的项目整体跳过依赖类规则；`deny` 与能力首选的冲突在启动时报错。
- **适配器**：`defineAdapter` 字段白名单与样例校验、UI 组件库适配器（`antdKit` / `noneKit`）、组件库指纹数据（换库残留验收）。
- **本体自包含检查**：P1 依赖白名单 / P2 宿主字面量 / P3 引擎无布局假设（`--self-check-portability`）。
- **夹具回归**：`--self-test`，三个夹具（合规零误报 / 10 条违规全报 / 坏语法 fail-closed）。
- **构建与发布链路**：`pagoda-cli build`（lib 模式、保留模块结构）→ `es/` ESM + `.d.ts`，`private: false` 可发布形态；ESM-only（CJS 产物的相对路径与 `.js` 规范不兼容，见 docs/DESIGN.md）。
- **库 / CLI 范式**：`presets/library.ts`（库角色表 + 库适用规则集），本体用自己跑狗粮（`pnpm guard:self`）；据此修正三处规则精度（H04 字符串判据收紧、S11 放行 `export type *`、hygiene 不再抢规则选择权）并让配置豁免在报告里可见。
- **选型纪律（设计）**：`data/wheel-fingerprints.ts`（能力表 + 强/弱指纹 + 库 API 名），PARADIGM §12 / SPEC §16。
- **文档**：`PARADIGM.md`（通用范式，可整篇搬到别的仓库）、`docs/DESIGN.md`（完整设计与架构自审）、`README.md`。

### Changed

- **`docs/SPEC.md` → `docs/DESIGN.md`**：按 `docs/agents/issue-tracker.md` 的约定，`spec.md` 这个名字**只给 `.scratch/<feature-slug>/spec.md`**（特性规格，做完归档）；持久的设计参考文档改名 `DESIGN.md`，并在规范文件里写明「哪些不是 spec」，避免下次再被占用。
- **体积阈值默认 400/320 → 500**（`fileLines` / `viewLines`），仍可按项目覆盖：`overrides.thresholds`。
- **`docs/DESIGN.md` 瘦身 1185 → 719 行**：规范类章节（原 §2/§3/§4/§7.5）改为指向 `PARADIGM.md` 避免两处真相；状态类章节（原 §8/§9/§10/§11/§13/§15：交付物 / superhive 落地 / 分期 / 验收 / 待拍板 / 归属抽取）删除——状态归 README + CHANGELOG；原 §14「架构自审 18 项」收敛为「已知缺口（未实现）」清单。
- **能力指纹判定改为按文件**：按全项目判会放过「部分迁移」（一个文件用了 dayjs、另一个还在手搓）；现在命中的文件必须自己 import 登记方案，正确封装在别处的文件不会被误报。
- **datetime 强指纹补齐**：`toISOString().slice`、`getFullYear/getMonth/getDate/getHours/getMinutes`、`Date.now() ± 毫秒` 等常见手搓形态；每文件报首个命中行并标注「另有 N 处」。
- **删除冗余的 `deny` 默认值**：白名单（`allow`）一旦启用，未登记依赖已被 P01 拦下，黑名单只是第二份要同步的名册；预设不再替项目做选型决定（`deps()` 默认 `allow: [] / deny: []`）。本体自己的配置也删掉 `deny`。

### Fixed

- **`typescript@7` 下必崩**：TS 7 是原生重写，JS 侧不再暴露 `createSourceFile` / `ScriptKind`，而我们的 peer 范围 `>=5.4.0` 放行了它 —— 用户装到 TS 7 会在 `ts.ScriptKind.TS` 上抛 `undefined`。现在：peer 收紧为 `>=5.4.0 <7`，并在加载时 fail-fast 给出可执行报错（"请安装 typescript@6"）。由发布验收中的真实消费方安装暴露。
- **发布产物带开发机绝对路径**：`sourcemap: true` 让 `.js.map` 里写进 `/Users/...`。关掉 sourcemap，包体 112K → 56K。
- **依赖图解析不到 `.js` 指向 `.ts` 的导入**（TS nodenext 写法）—— 我们自己的源码正是这种写法，等于依赖图对本仓库是空的，S15/S08 一旦实现就会静默失效。
- **空块内的注释漏采**（`catch { /* 忽略 */ }`）—— H05「空 catch 是否写明理由」的判据因此失效；改用 TS scanner 采集全部注释 trivia。
- **裸调用（`alert` / `confirm` / `prompt`）没进事实模型** —— H03 只记录了带 `.` 的调用，这三类调试残留抓不到。
