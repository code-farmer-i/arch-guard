import assert from 'node:assert/strict'
import { test } from 'node:test'

import { canonical, library, libraryRoleTable, roleTable } from '../es/presets/index.js'

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
