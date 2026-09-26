import assert from 'node:assert/strict'
import { test } from 'node:test'

import { DEFAULT_NAMING, DEFAULT_THRESHOLDS } from '../es/engine/defaults.js'
import { ENV_READ_ROOTS } from '../es/data/env-roots.js'
import {
  antdKit,
  canonical,
  cssModulesKit,
  dataLayer,
  fsd,
  fsdRoleTable,
  i18n,
  i18nextKit,
  library,
  libraryRoleTable,
  reactQueryKit,
  reactRouterKit,
  roleTable,
  router,
  analytics,
  envReads,
  callSites,
  styles,
  uiKit,
} from '../es/presets/index.js'

test('presets：阈值与命名契约只有一份默认值（范式不再各抄一份数字）', () => {
  // 这条盯的是「同一个事实的第二处存放」：阈值原先在引擎兜底 / canonical / library 各写一遍，
  // 改一处另外两处就静默漂移。现在三个范式都从 engine/defaults.ts 取。
  for (const [name, preset] of [
    ['canonical', canonical()],
    ['library', library()],
    ['fsd', fsd()],
  ]) {
    assert.deepEqual(
      preset.thresholds ?? null,
      DEFAULT_THRESHOLDS,
      `${name} 的阈值必须等于唯一默认值`,
    )
    assert.deepEqual(preset.naming ?? null, DEFAULT_NAMING, `${name} 的命名契约必须等于唯一默认值`)
  }
  // 库范式不声明落点、但阈值照样有默认值（由引擎兜底取同一份常量）
  assert.deepEqual(DEFAULT_THRESHOLDS, {
    fileLines: 500,
    viewLines: 500,
    functionLines: 150,
    exportsPerFile: 6,
    componentsPerFile: 3,
  })
})

test('presets：canonical 默认就是范式三根目录', () => {
  const preset = canonical()
  assert.deepEqual(preset.layout, { app: 'src/app', modules: 'src/modules', shared: 'src/shared' })
  assert.equal(preset.srcRoot, 'src')
  assert.deepEqual(preset.entries, ['src/app/main.tsx'])
  assert.ok(preset.roles.some((role) => role.pattern === 'src/modules/{domain}/views/**'))
  // 层号只挂在角色描述符上（`record.layer`）—— 那条线上没有第二份 layers 表
  assert.equal(preset.roles.find((role) => role.slot === 'views')?.layer, 10)
  assert.equal(preset.roles.find((role) => role.id === 'shared:components:ui')?.layer, 8)
  assert.equal(preset.layers, undefined, 'config.layers 是死配置，已删')
})

test('presets：canonical 自定义目录时角色表与条目一起跟着变', () => {
  const preset = canonical({
    src: 'app-src',
    app: 'app-src/assembly',
    modules: 'app-src/domains',
    shared: 'app-src/common',
  })
  assert.deepEqual(preset.layout, {
    app: 'app-src/assembly',
    modules: 'app-src/domains',
    shared: 'app-src/common',
  })
  assert.equal(preset.srcRoot, 'app-src')
  assert.deepEqual(preset.entries, ['app-src/assembly/main.tsx'])
  assert.ok(preset.roles.some((role) => role.pattern === 'app-src/domains/{domain}/views/**'))
})

test('presets：只传部分参数时其余走范式默认（src 推导 app/modules/shared）', () => {
  const onlySrc = canonical({ src: 'app-src' })
  assert.deepEqual(onlySrc.layout, {
    app: 'app-src/app',
    modules: 'app-src/modules',
    shared: 'app-src/shared',
  })
  assert.deepEqual(onlySrc.entries, ['app-src/app/main.tsx'])
})

test('能力提供者必须启用消费它的规则（防"适配器装了却静默失效"）', async () => {
  const { coreRules, copy, designSystem, endpoints, metrics, uiKit, antdKit, canonical } =
    await import('../es/index.js')
  // 能力前缀 → **负责启用**该能力对应规则的预设。
  // 注意：能力（适配器）与规则集是两件事 —— i18n 的能力由 `i18n(i18nextKit())` 给，
  // 但"启用 C 域规则"永远是 `copy()`；所以这张表查的是"谁启用"，不是"谁提供适配器"。
  const providers = {
    designSystem: designSystem(),
    i18n: copy(),
    metrics: metrics(),
    uiKit: uiKit(antdKit()),
    // 方案面：落点类能力（`dataLayer.queryKeyFrom` / `router.pathSource`）由装了适配器那一侧启用
    dataLayer: dataLayer(reactQueryKit()),
    router: router(reactRouterKit()),
    callSites: callSites([{ name: '副作用', apis: ['gtag'], in: ['src/shared/lib/analytics.ts'] }]),
    analytics: analytics({ apis: ['track'], eventSource: 'src/shared/lib/analytics/events.ts' }),
    envReads: envReads({ apis: ['import.meta.env'], in: ['src/shared/config/**'] }),
    endpoints: endpoints({ apis: ['fetch'], source: 'src/shared/api/endpoints.ts' }),
    // `structure.slots` 是**范式事实**（参数型能力）：由带槽位语义的范式声明 —— canonical 是那个
    structure: canonical(),
  }
  const missing = []
  for (const rule of coreRules) {
    for (const capability of rule.requires ?? []) {
      const prefix = capability.split('.')[0]
      const provider = providers[prefix]
      assert.ok(provider, `能力 ${prefix} 没有对应的预设 —— 新增能力时补进本测试的 providers 表`)
      const enable = provider.enable
      const enabled = enable === 'all' || (Array.isArray(enable) && enable.includes(rule.id))
      if (!enabled) missing.push(`${rule.id} 依赖 ${capability}，但 ${prefix} 预设没启用它`)
    }
  }
  assert.deepEqual(missing, [], '适配器给了数据却没人读 = 静默失效')
})
test('presets：fsd() 把 FSD 三层模型落成数据（层号 + 切片维度 + 公开面 + 片段封闭枚举）', () => {
  const preset = fsd()
  const roles = preset.roles
  // 切片根：公开面（entry）+ 组维度（slice）+ 层号
  const index = roles.find((role) => role.id === 'fsd:pages:index')
  assert.equal(index?.entry, true)
  assert.equal(index?.group, 'slice')
  assert.equal(index?.layer, 5)
  // 片段：同组、同层，路径里带 {slice}
  const ui = roles.find((role) => role.id === 'fsd:pages:ui')
  assert.equal(ui?.pattern, 'src/pages/{slice}/ui/**')
  assert.equal(ui?.group, 'slice')
  assert.equal(ui?.layer, 5)
  // 无切片层（app / shared）直接是片段
  assert.ok(roles.some((role) => role.id === 'fsd:shared:ui'))
  assert.ok(roles.some((role) => role.id === 'fsd:app:router'))
  // 默认片段都过 segments-by-purpose：`assets` / `providers` 是常见的**按内容命名**，故意不入默认
  assert.equal(
    roles.some((role) => role.id === 'fsd:shared:assets' || role.id === 'fsd:app:providers'),
    false,
    '这两个名字会被社区 linter 判为按内容命名，需要时显式加',
  )
  // 片段是**闭集**：没列到的片段不进角色表 → 由 S01 报出来
  assert.equal(
    roles.some((role) => role.pattern.includes('components')),
    false,
    '未登记的片段不该出现在角色表里',
  )
  // 三条结构规矩全部走通用规则
  // 结构声明全在数据里（规则不认方法论）：公开面 / 空壳组 / 保留名 / 规模阈值 / 死切片 / 命名
  assert.deepEqual(preset.structure, {
    order: true,
    isolate: ['slice'],
    publicApi: ['slice'],
    publicApiUnits: [
      { role: 'fsd:shared:ui', children: true },
      { role: 'fsd:shared:lib', children: true },
      { role: 'fsd:shared:api' },
      { role: 'fsd:shared:config' },
      { role: 'fsd:shared:i18n' },
      { role: 'fsd:shared:routes' },
    ],
    segmentedGroups: ['slice'],
    reservedNames: ['ui', 'api', 'lib', 'model', 'config', '@x'],
    groupCountLimits: [{ dimension: 'slice', max: 20 }],
    directoryItemLimits: [{ role: 'fsd:shared:lib', max: 15 }],
    groupInDegree: [{ dimension: 'slice', min: 1, exceptLayers: [5], singleFromLayers: [6] }],
    nameCollisions: [
      {
        dimension: 'slice',
        vocabularyRoles: [
          'fsd:shared:ui',
          'fsd:shared:lib',
          'fsd:shared:api',
          'fsd:shared:config',
          'fsd:shared:i18n',
          'fsd:shared:routes',
        ],
      },
    ],
    repetitiveNaming: ['slice'],
    pluralConsistency: [{ dimension: 'slice', layers: [2] }],
  })
  // FSD 没有三根的「域 / 共享层」：置空让应用专属规则自然空转，而不是查不存在的目录假装检查过
  assert.equal(preset.layout.modules, '')
  assert.equal(preset.layout.shared, '')
  // 分组切片必须显式打开（两种形态无法用一组 glob 同时表达，否则会角色歧义）
  assert.equal(
    fsd({ slicesGrouped: true }).roles.find((role) => role.id === 'fsd:pages:ui')?.pattern,
    'src/pages/{group}/{slice}/ui/**',
  )
  assert.equal(
    fsdRoleTable({ src: 'app-src' }).some((role) => role.pattern.startsWith('app-src/')),
    true,
  )
})
test('presets：library 是「入口 + 目录表」，默认关掉应用专属规则', () => {
  const preset = library()
  assert.equal(preset.layout.app, 'src')
  // 库没有应用的「域 / 共享层」：置空表示不存在，依赖它们的图规则才会自然空转，
  // 而不是去查一个不存在的 `${srcRoot}/modules` 假装检查过
  assert.equal(preset.layout.modules, '')
  assert.equal(preset.layout.shared, '')
  // 项目专有的目录（构建产物、示例、夹具）属于**宿主**配置，不该由通用预设写死
  assert.equal(preset.ignore.includes('examples/**'), false, '宿主路径不进通用预设')
  assert.ok(preset.include.includes('src/**'), '契约扫描域收窄到源码根')
  assert.deepEqual(preset.entries, ['src/index.ts'])
  // 应用专属（域/路由/入口）不在库的启用名单里
  for (const id of ['S05', 'S06', 'S14', 'S15']) {
    assert.equal(preset.enable.includes(id), false, `${id} 不该在库范式里启用`)
  }
  assert.ok(preset.enable.includes('S16'))

  const custom = library({ src: 'lib-src' })
  assert.equal(custom.srcRoot, 'lib-src')
  // 测试文件是全局 glob（`**/*.test.*`），其余角色必须落在自定义 src 下
  const scoped = custom.roles.filter((role) => !role.pattern.startsWith('**/'))
  assert.ok(scoped.length > 0)
  assert.ok(
    scoped.every((role) => role.pattern.startsWith('lib-src')),
    scoped.map((role) => role.pattern).join(', '),
  )
})

test('presets：library 的目录表由项目给 —— 目录 → 层号，入口可多点', () => {
  const preset = library({
    src: 'lib',
    modules: { utils: 1, core: 2 },
    entry: ['index.ts', 'cli.ts'],
  })
  assert.deepEqual(preset.entries, ['lib/index.ts', 'lib/cli.ts'])
  assert.deepEqual(
    preset.roles
      .filter((role) => role.id.startsWith('lib:'))
      .map((r) => [r.id, r.pattern, r.layer]),
    [
      ['lib:entry', 'lib/index.ts', 10],
      ['lib:entry', 'lib/cli.ts', 10],
      ['lib:utils', 'lib/utils/**', 1],
      ['lib:core', 'lib/core/**', 2],
    ],
  )
  // 内部目录**不设 slot**：目录名恰好叫 lib / hooks 时不会误套应用范式的槽位语义
  assert.ok(preset.roles.every((role) => role.slot === undefined || role.slot === 'entry'))
})

test('presets：角色表构造函数也能被直接调用（只给 src 时其余按范式推导）', () => {
  const app = roleTable({ src: 'src' })
  assert.ok(app.some((role) => role.pattern === 'src/app/main.{ts,tsx}'))
  assert.ok(app.some((role) => role.pattern === 'src/modules/{domain}/routes.{ts,tsx}'))

  // 库：默认只认入口；目录表由项目声明
  const lib = libraryRoleTable({ src: 'src' })
  assert.ok(lib.some((role) => role.pattern === 'src/index.ts'))
  assert.equal(
    lib.some((role) => role.pattern.includes('engine')),
    false,
    '不再写死本体的目录名',
  )
  assert.ok(lib.every((role) => role.layer >= 0))
  const layered = libraryRoleTable({ src: 'src', modules: { utils: 1 } })
  assert.ok(layered.some((role) => role.id === 'lib:utils' && role.layer === 1))
})

test('presets：方案面（router / data-layer / styles）各自贡献 P12，kit 只声明数据', () => {
  const routerKit = reactRouterKit()
  assert.deepEqual(
    routerKit.packages,
    ['react-router', 'react-router-dom'],
    '同一个方案的两个包都算"已登记"',
  )
  assert.equal(router(routerKit).enable.includes('P12'), true, '装了适配器必须启用消费它的规则')
  assert.equal(router(routerKit).adapters?.router?.facet, 'router')
  // 方案面还声明**形态**词汇：域的入口文件名（S03/S04/S05/S14/S15 照它判）
  assert.deepEqual(
    routerKit.routeFiles,
    ['routes.ts', 'routes.tsx'],
    '入口词汇与范式角色表 routes.{ts,tsx} 对齐（以前规则里写死 .tsx，routes.ts 会被误报）',
  )
  assert.deepEqual(
    reactRouterKit({ routeFiles: ['router.ts'] }).routeFiles,
    ['router.ts'],
    '自定义入口名走 kit 参数（不再往配置里塞裸适配器对象）',
  )

  assert.equal(dataLayer(reactQueryKit()).enable.includes('P12'), true)
  assert.deepEqual(dataLayer(reactQueryKit()).adapters?.['data-layer']?.packages, [
    '@tanstack/react-query',
  ])
  // 方案面的**落点**由 kit 收参，并带出它消费的规则（D22 缓存键唯一出处）
  const dataPreset = dataLayer(reactQueryKit({ queryKeyFrom: 'src/shared/api/queryKeys.ts' }))
  assert.equal(dataPreset.enable.includes('D22'), true, '声明了落点就要启用消费它的规则')
  assert.equal(dataPreset.adapters?.['data-layer']?.queryKeyFrom, 'src/shared/api/queryKeys.ts')
  assert.equal(
    router(reactRouterKit({ pathSource: 'src/shared/config/paths.ts' })).enable.includes('D23'),
    true,
  )
  assert.equal(
    router(reactRouterKit({ pathSource: 'src/shared/config/paths.ts' })).adapters?.router
      ?.pathSource,
    'src/shared/config/paths.ts',
  )

  const stylesPreset = styles(cssModulesKit())
  assert.equal(stylesPreset.enable.includes('P12'), true)
  assert.deepEqual(
    stylesPreset.adapters?.styles?.packages,
    [],
    'CSS Module 没有包，声明的是"已选方案"',
  )
  // 组件样式文件的形态（D16 / D17 照它判）：CSS Module 的默认形态是 *.module.css
  assert.deepEqual(stylesPreset.adapters?.styles?.modulePatterns, ['\\.module\\.css$'])

  // 组件库 / i18n 也纳入 P12（声明 antd 又 import mui 是同类混用）
  assert.equal(uiKit(antdKit()).enable.includes('P12'), true)
  assert.equal(i18n(i18nextKit({ languages: ['zh-CN'] })).enable.includes('P12'), true)
})

test('presets：fsd() 与社区文件系统模型对齐的几处形态', () => {
  const roles = fsd().roles
  const byId = (id) => roles.find((role) => role.id === id)

  // ① 入口认**代码扩展名**（社区模型认任何 `index.*`；我们只认代码扩展名，见 ALTERNATIVES 的「已知边界」）
  assert.match(byId('fsd:pages:index')?.pattern ?? '', /\{ts,tsx,js,jsx,mjs,cjs\}/)
  assert.equal(byId('fsd:app:main')?.pattern, 'src/app/main.{ts,tsx,js,jsx,mjs,cjs}')
  // 环境特定公开面（上游 v2.1 对齐）仍是公开面
  assert.equal(byId('fsd:pages:index')?.entry, true)
  assert.ok(
    [...roles].some((role) =>
      role.pattern.includes('index.{server,client}.{ts,tsx,js,jsx,mjs,cjs}'),
    ),
  )

  // ② 单文件片段（`entities/user/model.ts`）合法，不是 S01
  assert.equal(byId('fsd:entities:model:file')?.pattern, 'src/entities/{slice}/model.{ts,tsx}')
  assert.equal(byId('fsd:entities:model:file')?.group, 'slice')

  // ③ shared 片段有**根入口**角色：根有 index 就整段跳过子目录检查（与社区模型同口径）
  assert.equal(
    byId('fsd:shared:ui:root-index')?.pattern,
    'src/shared/ui/index.{ts,tsx,js,jsx,mjs,cjs}',
  )
  assert.equal(byId('fsd:shared:ui:root-index')?.entry, true)
  assert.equal(
    byId('fsd:shared:ui:index')?.pattern,
    'src/shared/ui/{child}/index.{ts,tsx,js,jsx,mjs,cjs}',
  )
  // 非常规片段（i18n / routes）的入口就是片段根的 index
  assert.equal(
    byId('fsd:shared:i18n:index')?.pattern,
    'src/shared/i18n/index.{ts,tsx,js,jsx,mjs,cjs}',
  )

  // ④ 切片身份不受影响：入口仍带组维度，片段仍带 `group: 'slice'`
  assert.equal(byId('fsd:pages:index')?.group, 'slice')
  assert.equal(byId('fsd:pages:ui')?.group, 'slice')
})

test('canonical：域角色声明 group=domain（否则按组判定的规则在应用范式下集体沉默）', () => {
  const roles = canonical().roles ?? []
  const domainRoles = roles.filter((role) => role.pattern.includes('{domain}'))
  assert.ok(domainRoles.length >= 7, '七个域槽位都该有域捕获')
  for (const role of domainRoles) {
    assert.equal(role.group, 'domain', `${role.id} 没声明 group: domain`)
  }
})

test('R-93：envReads({ in }) 省略 apis 时，读取根取平台表（不必每个宿主抄 import.meta.env）', () => {
  const preset = envReads({ in: ['src/shared/config/**'] })
  assert.deepEqual(preset.adapters['env-reads'].apis, ENV_READ_ROOTS)
  assert.equal(preset.adapters['env-reads'].apisFrom, 'platform')
  // 显式给了就按项目给的走（并且会被"0 命中"自述校验拼写）
  const explicit = envReads({ apis: ['import.meta.env'], in: ['src/shared/config/**'] })
  assert.deepEqual(explicit.adapters['env-reads'].apis, ['import.meta.env'])
  assert.equal(explicit.adapters['env-reads'].apisFrom, undefined)
})
