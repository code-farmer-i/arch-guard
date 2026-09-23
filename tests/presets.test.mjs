import assert from 'node:assert/strict'
import { test } from 'node:test'

import { canonical, library, libraryRoleTable, roleTable } from '../es/presets/index.js'

test('presets：canonical 默认就是范式三根目录', () => {
  const preset = canonical()
  assert.deepEqual(preset.layout, { app: 'src/app', modules: 'src/modules', shared: 'src/shared' })
  assert.equal(preset.srcRoot, 'src')
  assert.deepEqual(preset.entries, ['src/app/main.tsx'])
  assert.ok(preset.roles.some((role) => role.pattern === 'src/modules/{domain}/views/**'))
  // 共享层线性层序：styles 0 → components 8 → modules 10 → app 11
  assert.equal(preset.layers['src/shared/styles'], 0)
  assert.equal(preset.layers['src/shared/components'], 8)
  assert.equal(preset.layers['src/modules'], 10)
  assert.equal(preset.layers['src/app'], 11)
})

test('presets：canonical 自定义目录时角色表、层序、条目一起跟着变', () => {
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
  assert.equal(preset.layers['app-src/common/lib'], 1)
  assert.equal(preset.layers['app-src/assembly'], 11)
})

test('presets：只传部分参数时其余走范式默认（src 推导 app/modules/shared）', () => {
  const onlySrc = canonical({ src: 'app-src' })
  assert.deepEqual(onlySrc.layout, {
    app: 'app-src/app',
    modules: 'app-src/modules',
    shared: 'app-src/shared',
  })
  assert.equal(onlySrc.layers['app-src/shared/lib'], 1)
  assert.deepEqual(onlySrc.entries, ['app-src/app/main.tsx'])
})

test('presets：library 用单根布局，且默认关掉应用专属规则', () => {
  const preset = library()
  assert.equal(preset.layout.app, 'src')
  assert.ok(preset.ignore.includes('examples/**'), '库不把示例当源码')
  assert.ok(preset.ignore.includes('__fixtures__/**'), '夹具不进门禁')
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

test('presets：角色表构造函数也能被直接调用（只给 src 时其余按范式推导）', () => {
  const app = roleTable({ src: 'src' })
  assert.ok(app.some((role) => role.pattern === 'src/app/main.{ts,tsx}'))
  assert.ok(app.some((role) => role.pattern === 'src/modules/{domain}/routes.{ts,tsx}'))

  const lib = libraryRoleTable({ src: 'src' })
  assert.ok(lib.some((role) => role.pattern === 'src/{index,cli}.ts'))
  assert.ok(lib.every((role) => role.layer >= 0))
})
