import assert from 'node:assert/strict'
import { test } from 'node:test'

import { canonical, fsd, library } from '../es/index.js'

/**
 * **元门禁：范式预设的结构词汇必须完整**（R-74）。
 *
 * 为什么需要：规则、声明、夹具都齐了，**范式预设这条路却可能是断的** ——
 * 2026-09-25 实测发现 6 条已实现的规则因为两行数据缺失（`canonical()` 的角色没声明 `group: 'domain'`、
 * `routes.tsx` 没标 `entry: true`）在前端应用里**从来没跑过**，而门禁一直显示"通过"。
 *
 * 这条测试把"每个范式预设必须提供哪些结构词汇"写成显式期望表：
 * 删掉 `group` / `entry` 就会红，而不是安静地让一批按组判定的规则集体沉默。
 */

/** 期望表：**改范式 = 改这里**（有捕获就必须能当组用；有入口语义就必须有 entry 角色） */
const EXPECTED = [
  {
    name: 'canonical',
    preset: canonical,
    groups: ['domain'],
    entry: true,
    why: '三根拓扑：`modules/{domain}` 是组维度，`routes.tsx` 是域的公开面入口（S03/S23 的前提）',
  },
  {
    name: 'fsd',
    preset: fsd,
    groups: ['slice'],
    entry: true,
    why: 'FSD：`{slice}` 是组维度，切片的 `index.ts` 是公开面入口',
  },
  {
    name: 'library',
    preset: library,
    groups: [],
    entry: false,
    why: '库范式没有"域 / 切片"概念，也没有公开面入口 —— 按组判定的规则对它天然不适用（靠声明才判，不是靠数据）',
  },
]

test('范式预设：域/切片捕获必须声明为组维度（否则按组判定的规则集体沉默）', () => {
  for (const spec of EXPECTED) {
    const roles = spec.preset().roles ?? []
    const captures = new Set()
    for (const role of roles) {
      for (const match of role.pattern.matchAll(/\{([a-zA-Z0-9_]+)\}/g)) captures.add(match[1])
    }
    const declared = new Set(roles.map((role) => role.group).filter(Boolean))
    for (const expected of spec.groups) {
      assert.ok(
        captures.has(expected),
        `${spec.name} 的角色表里没有 {${expected}} 捕获（期望表过时了？）`,
      )
      assert.ok(
        declared.has(expected),
        `${spec.name} 的 {${expected}} 捕获没有角色声明 group: '${expected}' —— ${spec.why}`,
      )
    }
    for (const name of declared) {
      assert.ok(
        spec.groups.includes(name),
        `${spec.name} 声明了未登记的组维度 ${name}（改范式要同步本测试的期望表）`,
      )
    }
  }
})

test('范式预设：有入口语义的范式必须有 entry 角色（否则 S23 / S35 不生效）', () => {
  for (const spec of EXPECTED) {
    const roles = spec.preset().roles ?? []
    const entries = roles.filter((role) => role.entry === true)
    if (spec.entry) {
      assert.ok(
        entries.length > 0,
        `${spec.name} 没有任何 entry: true 的角色 —— 公开面规则（S23）与空壳组（S35）等于关着`,
      )
    } else {
      assert.equal(entries.length, 0, `${spec.name} 不该有 entry 角色（期望表说它没有入口语义）`)
    }
  }
})

/**
 * **元门禁：范式无关的规则，不许在某个范式下"静默消失"**（R-87，R-74 的姊妹条）。
 *
 * R-74 管的是"规则注册了却在某个范式下永远不命中"；这条管**更靠前的一步**：
 * 规则**根本没被任何预设启用** —— 它既不跑、也不在报告的 `skipped` 停用清单里，
 * 于是宿主配了声明（`clientState` / `authRedirects` / `couplingLimits`…）也毫无作用，
 * 而报告一个字都不提。实测：`fsd()` 复用 `library()` 的启用清单，那清单里少了 9 条与范式无关的规则。
 *
 * 判据用**两份真实示例**（canonical 与 FSD，声明都给全）的差集，而不是手写规则名：
 * 差集必须**正好**是下面这批"应用专属"的规则，多一条就红。
 */
const APP_ONLY = [
  'S03', // 域根只许公开面入口
  'S04', // 域内 / 域外引用形态（别名约定）
  'S05', // 域外只许引 routes
  'S06', // views 对域外私有
  'S09', // app/layouts 不得 import modules
  'S14', // 域有 views 就必须有 routes
  'S15', // 可达性（域 routes 必被 app/router 聚合）
  'S18', // shared 只被一个域使用 → 下沉
  'S19', // 单文件导出值上限（应用侧的体积卫生；库的模块就是 API 面）
]

test('范式覆盖：除明列的应用专属规则，canonical 与 fsd 的注册集必须一致（不许静默消失）', async () => {
  const { coreRules, createRegistry, loadConfig } = await import('../es/index.js')
  const { join } = await import('node:path')
  const { fileURLToPath } = await import('node:url')
  const root = fileURLToPath(new URL('..', import.meta.url))

  const registered = async (example) => {
    const { config } = await loadConfig({ root: join(root, 'examples', example) })
    const registry = createRegistry(coreRules, config)
    return new Set([
      ...registry.enabled.map((rule) => rule.id),
      ...registry.skipped.map((item) => item.rule),
    ])
  }

  const canonicalSet = await registered('full')
  const fsdSet = await registered('full-fsd')
  const all = coreRules.map((rule) => rule.id)

  assert.deepEqual(
    all.filter((id) => !canonicalSet.has(id)),
    [],
    'canonical 示例里不许有"根本不注册"的规则（声明都给全了）',
  )
  assert.deepEqual(
    all.filter((id) => canonicalSet.has(id) && !fsdSet.has(id)).sort(),
    [...APP_ONLY].sort(),
    'fsd 少注册的规则必须**正好**是这批应用专属的；多一条 = 又有一条规则在某个范式下静默消失',
  )
})
