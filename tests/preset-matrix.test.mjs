import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { loadConfig } from '../es/engine/config.js'
import {
  canonical,
  copy,
  createRegistry,
  deps,
  designSystem,
  fsd,
  hygiene,
  library,
  metrics,
  coreRules,
} from '../es/index.js'

/**
 * 组合语义的**穷举**矩阵（docs/DESIGN.md §7.0.1 的论断必须有夹具，否则改 `mergePresets`
 * 会静默破坏组合：某个域的规则被另一域顶掉、范式被悄悄混用、落点退回三根）。
 *
 * 三条轴：范式（3 选 1）× 域预设（5 个，任意子集 = 2^5）× 正交适配器（不在本文件的矩阵内）。
 * 断言口径不是"能加载"而已 —— 而是**并集/加法/替换的语义逐条成立**：
 *   enable  = 范式与所选域预设的**并集**（任一为 'all' 则整体 'all'）
 *   structure = 各贡献者的**加法**（布尔取或、数组并集）
 *   roles / layout = 范式的，整体替换（域预设不许动）
 *   params.styleDir = **跟着范式走**（域预设不许塞三根默认值）
 */

const PACKAGE_ROOT = fileURLToPath(new URL('..', import.meta.url))
const INDEX_URL = pathToFileURL(join(PACKAGE_ROOT, 'es/index.js')).href

/** 范式：3 选 1。source 用于生成配置文本，factory 用于在测试进程里算出"期望值" —— 同一份预设 */
const PARADIGMS = {
  canonical: { source: 'canonical()', factory: () => canonical() },
  library: {
    source: 'library({ modules: { core: 1 } })',
    factory: () => library({ modules: { core: 1 } }),
  },
  fsd: { source: 'fsd()', factory: () => fsd() },
}
const PARADIGM_NAMES = Object.keys(PARADIGMS)

/** 域预设：任意子集（含空集）。参数一律不给 —— 本文件量的是组合，选项透传另有 stack.test.mjs */
const DOMAINS = {
  designSystem: { source: 'designSystem()', factory: () => designSystem() },
  copy: { source: 'copy()', factory: () => copy() },
  deps: { source: 'deps()', factory: () => deps() },
  metrics: { source: 'metrics()', factory: () => metrics() },
  hygiene: { source: 'hygiene()', factory: () => hygiene() },
}
const DOMAIN_NAMES = Object.keys(DOMAINS)

/** 2^5 个子集（空集也在内 —— "一个域预设都不加"是合法组合） */
const SUBSETS = []
for (let mask = 0; mask < 1 << DOMAIN_NAMES.length; mask += 1) {
  SUBSETS.push(DOMAIN_NAMES.filter((_, index) => (mask & (1 << index)) !== 0))
}

function makeProject() {
  const dir = mkdtempSync(join(tmpdir(), 'ag-matrix-'))
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({ name: 'matrix', private: true, type: 'module' }),
  )
  return dir
}

/** 写一份配置并加载；返回 config 与它自己的名字（失败时报出来是哪一格） */
async function loadCombo(dir, name, body) {
  const file = `${name}.mjs`
  writeFileSync(join(dir, file), body)
  return loadConfig({ root: dir, configPath: file })
}

const union = (left, right) => {
  if (left === 'all' || right === 'all') return 'all'
  const merged = [...new Set([...(left ?? []), ...(right ?? [])])]
  return merged.length > 0 ? merged : undefined
}

const configOf = (paradigm, subset) =>
  `import { ${[...PARADIGM_NAMES, ...DOMAIN_NAMES, 'reactPack'].join(', ')} } from '${INDEX_URL}'
export default {
  packs: [reactPack],
  presets: [${PARADIGMS[paradigm].source}, ${subset.map((name) => DOMAINS[name].source).join(', ')}],
}
`

test('组合矩阵：3 范式 × 2^5 域子集 = 96 种全部合法，且并集/加法/替换逐条成立', async () => {
  const dir = makeProject()
  const enableShapes = new Map(PARADIGM_NAMES.map((name) => [name, new Set()]))
  try {
    for (const paradigm of PARADIGM_NAMES) {
      const paradigmPreset = PARADIGMS[paradigm].factory()
      for (const subset of SUBSETS) {
        const label = `${paradigm}+[${subset.join(',') || '空'}]`
        const chosen = subset.map((name) => DOMAINS[name].factory())

        let loaded
        try {
          loaded = await loadCombo(
            dir,
            `cfg-${paradigm}-${subset.join('_') || 'none'}`,
            configOf(paradigm, subset),
          )
        } catch (error) {
          throw new Error(`${label} 加载失败：${error.message}`, { cause: error })
        }
        const { config } = loaded

        /* ---- enable：范式与各域的**并集**（任一 'all' → 'all'） ---- */
        let expectedEnable = paradigmPreset.enable
        for (const preset of chosen) expectedEnable = union(expectedEnable, preset.enable)
        if (expectedEnable === 'all' || expectedEnable === undefined) {
          assert.equal(config.enable, 'all', `${label}：应得到 'all'`)
        } else {
          assert.deepEqual(
            [...config.enable].sort(),
            [...expectedEnable].sort(),
            `${label}：enable 必须是各贡献者的并集（谁都不能被顶掉）`,
          )
        }
        enableShapes
          .get(paradigm)
          .add(config.enable === 'all' ? 'all' : JSON.stringify([...config.enable].sort()))

        /* ---- structure：**加法**（布尔取或、数组并集） ---- */
        const orders = [paradigmPreset, ...chosen].map((preset) => preset.structure?.order === true)
        const isolates = [
          ...new Set(
            [paradigmPreset, ...chosen].flatMap((preset) => preset.structure?.isolate ?? []),
          ),
        ]
        const publicApis = [
          ...new Set(
            [paradigmPreset, ...chosen].flatMap((preset) => preset.structure?.publicApi ?? []),
          ),
        ]
        assert.equal(config.structure.order, orders.some(Boolean), `${label}：order 取或失败`)
        assert.deepEqual(
          [...config.structure.isolate].sort(),
          isolates.sort(),
          `${label}：isolate 并集失败`,
        )
        assert.deepEqual(
          [...config.structure.publicApi].sort(),
          publicApis.sort(),
          `${label}：publicApi 并集失败`,
        )

        /* ---- roles / layout：**范式的**，整体替换（域预设不许动） ---- */
        assert.equal(
          config.roles.length,
          paradigmPreset.roles.length,
          `${label}：roles 被域预设改动了`,
        )
        assert.deepEqual(config.layout, paradigmPreset.layout, `${label}：layout 应完全来自范式`)

        /* ---- 落点跟着范式走：域预设不塞（也不改）任何落点 ---- */
        const wantsDesignSystem = subset.includes('designSystem')
        assert.equal(
          config.params.styleDir,
          paradigmPreset.params?.styleDir,
          `${label}：styleDir 必须来自范式；域预设不许补三根默认值（也不许改）`,
        )
        assert.equal(
          config.params.designSystemDeclared,
          wantsDesignSystem ? true : undefined,
          `${label}：designSystemDeclared 只在加了设计系统预设时出现（把"没声明"与"声明错了"分开）`,
        )
      }
    }

    /* ---- 组合必须是"可分辨"的：每个域子集都得到不同的规则集（否则说明某域的贡献被吞掉） ---- */
    assert.equal(
      enableShapes.get('canonical').size,
      1,
      'canonical 是 all：32 个子集都应得到同一个结果',
    )
    assert.equal(enableShapes.get('canonical').values().next().value, 'all')
    for (const paradigm of ['library', 'fsd']) {
      assert.equal(
        enableShapes.get(paradigm).size,
        SUBSETS.length,
        `${paradigm}：32 个域子集必须给出 32 份不同的规则集（并集真的在起作用）`,
      )
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('组合矩阵：范式三选一 —— 任取两个都 fail-closed，不静默混合角色表与布局', async () => {
  const dir = makeProject()
  try {
    for (const [a, b] of [
      ['canonical', 'library'],
      ['canonical', 'fsd'],
      ['library', 'fsd'],
    ]) {
      await assert.rejects(
        loadCombo(
          dir,
          `pair-${a}-${b}`,
          `import { canonical, library, fsd } from '${INDEX_URL}'\nexport default { presets: [${a}(), ${b}()] }\n`,
        ),
        /只能有一个范式预设/,
        `${a}+${b} 必须被拦下`,
      )
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('组合矩阵：同一预设写两遍幂等（并集 + 加法天然幂等）', async () => {
  const dir = makeProject()
  try {
    const once = await loadCombo(
      dir,
      'once',
      `import { library, designSystem, reactPack } from '${INDEX_URL}'\nexport default { packs: [reactPack], presets: [library({ modules: { core: 1 } }), designSystem()] }\n`,
    )
    const twice = await loadCombo(
      dir,
      'twice',
      `import { library, designSystem, reactPack } from '${INDEX_URL}'\nexport default { packs: [reactPack], presets: [library({ modules: { core: 1 } }), designSystem(), designSystem()] }\n`,
    )
    assert.deepEqual([...twice.config.enable].sort(), [...once.config.enable].sort())
    assert.deepEqual(twice.config.structure, once.config.structure)
    assert.deepEqual(twice.config.roles, once.config.roles)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('组合矩阵：域预设只写显式给的落点 —— 显式压过范式，不给就一个字都不写', async () => {
  const dir = makeProject()
  try {
    const explicit = await loadCombo(
      dir,
      'explicit',
      `import { canonical, designSystem, reactPack } from '${INDEX_URL}'\nexport default { packs: [reactPack], presets: [canonical(), designSystem({ styleDir: 'src/design' })] }\n`,
    )
    assert.equal(explicit.config.params.styleDir, 'src/design', '显式给的落点必须压过范式')
    assert.equal(
      explicit.config.params.tokenDir,
      'src/design/tokens',
      '给了 styleDir 时其余落点从它推导（少写几行）',
    )

    const silent = await loadCombo(
      dir,
      'silent',
      `import { canonical, designSystem, reactPack } from '${INDEX_URL}'\nexport default { packs: [reactPack], presets: [canonical(), designSystem()] }\n`,
    )
    assert.equal(
      silent.config.params.styleDir,
      'src/shared/styles',
      '不给就一个字都不写：落点仍由范式声明',
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('组合矩阵：disable 是减法 —— 与 enable 求完并集后再减，且只减那一条', async () => {
  const dir = makeProject()
  try {
    const body = (extra) => `import { library, designSystem, reactPack } from '${INDEX_URL}'
export default {
  packs: [reactPack],
  presets: [library({ modules: { core: 1 } }), designSystem()],
  ${extra}
}
`
    const plain = await loadCombo(dir, 'plain', body(''))
    const disabled = await loadCombo(dir, 'disable', body(`overrides: { disable: ['D11'] },`))

    // enable 是"各贡献者的并集"，减法记在 disable 上、由 registry 求完并集后执行
    assert.equal(disabled.config.enable.includes('D11'), true, 'enable 仍记着 D11 的贡献（并集）')
    assert.deepEqual(disabled.config.disable, ['D11'], '减法记在 disable 上')

    const before = createRegistry(coreRules, plain.config)
    const after = createRegistry(coreRules, disabled.config)
    assert.equal(
      before.enabled.some((rule) => rule.id === 'D11'),
      true,
      '不 disable 时 D11 应当在跑',
    )
    assert.equal(
      after.enabled.some((rule) => rule.id === 'D11'),
      false,
      'disable 必须真的把它减掉',
    )
    assert.equal(
      before.enabled.length - after.enabled.length,
      1,
      '只减掉那一条，不许误伤同域的其它规则',
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
