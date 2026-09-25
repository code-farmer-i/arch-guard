import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { createRegistry, hasCapability, loadConfig, coreRules } from '../es/index.js'

/**
 * 预设**组合语义**：从"用户选一个目录规范，域预设自由叠加"这个用例出发，
 * 把规则钉死在三件事上 ——
 *
 *   1. 一个配置只能有**一个范式预设**（多范式混用会得到"角色表一半、布局另一半"的错误组合）；
 *   2. **契约落点由范式声明**（域预设不再塞三根默认值，否则 `fsd() + designSystem()` 会被悄悄改回三根路径）；
 *   3. `addRoles` 是**追加**（在范式角色表之上加项目自己的目录），`roles` 仍是整体替换。
 */

const ES = new URL('../es/index.js', import.meta.url).href

function project(presets, extra = '') {
  const dir = mkdtempSync(join(tmpdir(), 'ag-compose-'))
  writeFileSync(
    join(dir, 'arch.config.mjs'),
    `import { canonical, copy, fsd, designSystem, i18n, i18nextKit, library } from '${ES}'\n` +
      `export default { packs: [], presets: [${presets}]${extra} }\n`,
  )
  return dir
}

const load = (presets, extra) => loadConfig({ root: project(presets, extra) }).then((r) => r.config)

test('组合：一个配置只能有一个范式预设（fail-closed，不静默混合）', async () => {
  await assert.rejects(
    () => loadConfig({ root: project('canonical(), fsd()') }),
    /只能有一个范式预设/,
  )
  await assert.rejects(
    () => loadConfig({ root: project('fsd(), canonical()') }),
    /只能有一个范式预设/,
  )
  await assert.rejects(
    () => loadConfig({ root: project('library(), fsd()') }),
    /只能有一个范式预设/,
  )
  // 范式 + 任意多域预设是允许的：它们只贡献适配器 / 参数 / 规则集
  await assert.doesNotReject(() => loadConfig({ root: project('fsd(), designSystem()') }))
})

test('组合：一个面只能有一个方案 —— 两份 kit 声明同一个面时 fail-closed（内容相同则幂等）', async () => {
  await assert.rejects(
    () =>
      loadConfig({
        root: project(
          "i18n(i18nextKit({ languages: ['zh-CN'] })), i18n(i18nextKit({ languages: ['en'] }))",
        ),
      }),
    /只能有一个方案/,
    '内容不同的两份声明会静默取后者（而适配器又不出现在报告里）→ 必须报错',
  )
  // 内容完全相同 = 幂等（`defineFacet` 对同一个面的重复登记也是这个态度）
  const config = await load(
    "canonical(), i18n(i18nextKit({ languages: ['zh-CN'] })), i18n(i18nextKit({ languages: ['zh-CN'] }))",
  )
  assert.equal(config.adapters.i18n?.id, 'i18next')
  assert.deepEqual(config.adapters.i18n?.languages, ['zh-CN'])
})

test('组合：契约落点跟随范式（域预设不再塞三根默认值）', async () => {
  const fsdConfig = await load('fsd(), designSystem()')
  // 全局样式归官方 `app/styles` 片段；令牌与第三方覆盖仍在 `shared/ui/styles` 下
  assert.equal(fsdConfig.params.styleDir, 'src/app/styles', 'FSD 的全局样式落点')
  assert.equal(fsdConfig.params.tokenDir, 'src/shared/ui/styles/tokens', 'FSD 的令牌落点')
  assert.equal(fsdConfig.params.vendorDir, 'src/shared/ui/styles/vendor')

  const canonConfig = await load('canonical(), designSystem()')
  assert.equal(canonConfig.params.styleDir, 'src/shared/styles', '三根的落点（与旧版一致）')

  // 用户显式给的压过范式
  const explicit = await load("fsd(), designSystem({ styleDir: 'app-assets/styles' })")
  assert.equal(explicit.params.styleDir, 'app-assets/styles')
  assert.equal(
    explicit.params.tokenDir,
    'app-assets/styles/tokens',
    '给了 styleDir 时其余路径从它推导',
  )

  // 谁都没声明 → 不写死参数，由 designParams() 的内置默认兜底（仍是三根路径）
  const bare = await load('library(), designSystem()')
  assert.equal(bare.params.styleDir, undefined)
})

test('组合：范式落点跟着 src 走（自定义源码根不会退回 src/）', async () => {
  const config = await load("canonical({ src: 'app-src' }), designSystem()")
  assert.equal(config.params.styleDir, 'app-src/shared/styles')
  assert.equal(config.params.storageFile, 'app-src/shared/config/storage.ts')
})

test('组合：i18n 落点同样跟着范式走（`copy()` 不再写死默认值）', async () => {
  const resourceDirOf = (config) => config.adapters.i18n?.resourceDir

  // `copy()` 只贡献规则集；适配器来自 `i18n(i18nextKit())`（库名只许在 presets/i18n-kits/）
  const bare = await load('canonical(), copy()')
  assert.equal(resourceDirOf(bare), undefined, 'copy() 不再内联适配器（通用预设里没有库名）')
  assert.equal(hasCapability(bare, 'i18n.resourceDir'), false, '没有适配器 = 没有能力，不静默跑')

  const canon = await load('canonical(), copy(), i18n(i18nextKit())')
  assert.equal(resourceDirOf(canon), 'src/shared/i18n/locales', '三根的落点由范式补')
  assert.equal(
    resourceDirOf(await load("canonical({ src: 'app-src' }), copy(), i18n(i18nextKit())")),
    'app-src/shared/i18n/locales',
    '跟着 src 走（不再写死 src/）',
  )
  assert.equal(
    resourceDirOf(await load('fsd(), copy(), i18n(i18nextKit())')),
    'src/shared/i18n/locales',
    'FSD 的落点',
  )

  // 显式给的压过范式
  assert.equal(
    resourceDirOf(await load("fsd(), copy(), i18n(i18nextKit({ resourceDir: 'src/i18n' }))")),
    'src/i18n',
  )

  // 库范式不声明 i18n 落点 → 适配器没有 resourceDir → C 域**因能力未声明而停用**（fail-closed 且可见）
  const lib = await load("library(), copy(), i18n(i18nextKit({ languages: ['zh-CN'] }))")
  assert.equal(resourceDirOf(lib), undefined)
  assert.equal(hasCapability(lib, 'i18n.resourceDir'), false, '没落点 = 没能力（不静默跑）')
  assert.equal(hasCapability(canon, 'i18n.resourceDir'), true, '范式声明了落点 = 有能力')
})
test('组合：`all` 是「应用范式默认全查」，仍可被收窄（disable / overrides.enable）', async () => {
  const enabledIds = (config) => createRegistry(coreRules, config).enabled.map((rule) => rule.id)

  const all = await load('canonical(), copy(), i18n(i18nextKit())')
  assert.ok(enabledIds(all).includes('C03'), '应用范式默认全查')

  const narrowed = await load(
    'canonical(), copy(), i18n(i18nextKit())',
    ", overrides: { disable: ['C03'] }",
  )
  assert.equal(enabledIds(narrowed).includes('C03'), false, 'disable 能收窄')

  const replaced = await load('canonical()', ", overrides: { enable: ['S01'] }")
  assert.deepEqual(enabledIds(replaced), ['S01'], 'overrides.enable 是整体替换（我全都要自己定）')
})
test('组合：addRoles 追加在范式角色表之上，roles 仍是整体替换', async () => {
  const base = await load('fsd()')
  const added = await load(
    'fsd()',
    ", overrides: { addRoles: [{ id: 'legacy', pattern: 'src/legacy/**', layer: 1 }] }",
  )
  assert.equal(added.roles.length, base.roles.length + 1)
  assert.ok(
    added.roles.some((role) => role.id === 'legacy'),
    '追加的角色在',
  )
  assert.ok(
    added.roles.some((role) => role.id === 'fsd:pages:index'),
    '范式的角色也还在',
  )

  // 整体替换：overrides.roles 一给，范式那套就不在了（老语义不变）。
  // 用 `library()` 演示这条语义：它只有层序声明，没有"指向具体角色"的结构声明。
  const replaced = await load(
    'library({ entry: [] })',
    ", overrides: { roles: [{ id: 'only', pattern: 'src/**', layer: 1 }] }",
  )
  assert.deepEqual(
    replaced.roles.map((role) => role.id),
    ['only'],
  )
  // 换掉角色表却仍留着 `fsd()` 会 fail-fast：它的结构声明指向 fsd 自己的角色与组维度，
  // 整体替换后这些声明永远不生效 —— 结构声明校验直接报错（见 engine/structure.ts）。
  // 要自己的角色表就用 library()/canonical()，别留着 fsd()。
  await assert.rejects(
    () => load('fsd()', ", overrides: { roles: [{ id: 'only', pattern: 'src/**', layer: 1 }] }"),
    /没有任何角色用它做组维度/,
  )
})
