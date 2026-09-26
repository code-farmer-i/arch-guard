import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { loadConfig } from '../es/index.js'
import { initConfig, writeInitConfig } from '../es/presets/init.js'

/**
 * `arch-guard init`（R-106）：用户只回答"选什么"，生成物**必须能通过 `loadConfig`** ——
 * 一段好看但加载不了的模板没有意义。这里用真包（`node_modules/@arch-guard/core` 软链到本仓）
 * 跑端到端的加载，而不是把 import 换掉再看。
 */

const ROOT = fileURLToPath(new URL('..', import.meta.url))

function project() {
  const dir = mkdtempSync(join(tmpdir(), 'ag-init-'))
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'x', private: true }))
  mkdirSync(join(dir, 'node_modules', '@arch-guard'), { recursive: true })
  symlinkSync(ROOT, join(dir, 'node_modules', '@arch-guard', 'core'), 'dir')
  return dir
}

test('init：选 antd + react-query + i18next → 生成的配置能加载，且适配器就是选的那些', async () => {
  const dir = project()
  try {
    const { written, path } = writeInitConfig(
      { ui: 'antd', data: 'react-query', i18n: 'i18next', langs: 'zh-CN,en' },
      dir,
    )
    assert.ok(written, '首次生成应当写入')
    assert.ok(path.endsWith('arch.config.mjs'))

    const { config } = await loadConfig({ root: dir })
    assert.equal(config.adapters['ui-kit']?.id, 'antd')
    assert.equal(config.adapters['data-layer']?.id, 'react-query')
    assert.equal(config.adapters.i18n?.id, 'i18next')
    assert.equal(config.adapters.i18n?.resourceDir, 'src/shared/i18n/locales')
    assert.equal(config.adapters.endpoints, undefined, '没选的面就不声明（不猜）')
    // 已存在 → 不覆盖（要覆盖得显式 --force，且必须带上同样的选项）
    assert.equal(writeInitConfig({}, dir).written, false)
    assert.equal(
      writeInitConfig({ ui: 'antd', data: 'react-query', i18n: 'i18next', force: true }, dir)
        .written,
      true,
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('init：三种范式 × 不选库的形态都能加载（默认声明空能力，不是静默失能）', async () => {
  for (const paradigm of ['canonical', 'fsd', 'library']) {
    const dir = project()
    try {
      writeInitConfig({ paradigm }, dir)
      const { config } = await loadConfig({ root: dir })
      assert.equal(config.adapters['ui-kit']?.id, 'none', `${paradigm}：默认空 kit`)
      assert.equal(config.adapters.i18n, undefined, `${paradigm}：没选 i18n 就不注册`)
      assert.ok(initConfig({ paradigm }).includes(`${paradigm}(`), `${paradigm}() 要在 presets 里`)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }
})
