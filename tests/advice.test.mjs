import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { pushAdviceNotices } from '../es/engine/advice.js'
import { coreRules, runGuard } from '../es/index.js'

/**
 * 架构建议（R-118）：从已有事实算**可核对的信号** + 处方选项，且**永不阻断**。
 * 判据细节：只数具名导入 · 只算"每个导出恰好被一个域用" · 纯类型导出不算 · 公开面入口不算。
 */

const fact = (over = {}) => ({
  imports: [],
  exports: [],
  strings: [],
  calls: [],
  reads: [],
  numbers: [],
  functions: [],
  ...over,
})

function advise({ records, facts, edges }) {
  const notices = []
  pushAdviceNotices(
    {
      config: { roles: [] },
      records,
      facts: new Map(Object.entries(facts)),
      graph: { importers: edges.importers ?? new Map(), edges: new Map() },
      files: records.map((record) => record.rel),
    },
    notices,
  )
  return notices.filter((notice) => notice.code === 'architecture-advice')
}

const shared = (rel, names) => ({
  rel,
  domain: 'shared',
  captures: {},
  exports: names.map((name) => ({ name, declared: true, typeOnly: false })),
})
const page = (rel, domain, imports) => ({
  rel,
  domain,
  captures: {},
  exports: [],
  imports,
})
/** 从 `src/modules/<域>/hooks/x.ts` 指向 `src/shared/api/client.ts` 的相对路径 */
const consumer = (name) => ({ spec: '../../../shared/api/client', names: [name] })

test('R-118：一个文件里 ≥3 个导出各归各域 → 给建议（并列出证据）', () => {
  const records = [
    shared('src/shared/api/client.ts', ['fetchCrews', 'fetchOrders', 'fetchCustomers']),
    page('src/modules/crews/hooks/a.ts', 'crews'),
    page('src/modules/orders/hooks/b.ts', 'orders'),
    page('src/modules/customers/hooks/c.ts', 'customers'),
  ]
  const facts = {
    'src/shared/api/client.ts': fact({
      exports: records[0].exports,
    }),
    'src/modules/crews/hooks/a.ts': fact({ imports: [consumer('fetchCrews')] }),
    'src/modules/orders/hooks/b.ts': fact({ imports: [consumer('fetchOrders')] }),
    'src/modules/customers/hooks/c.ts': fact({ imports: [consumer('fetchCustomers')] }),
  }
  const importers = new Map([
    [
      'src/shared/api/client.ts',
      new Set([
        'src/modules/crews/hooks/a.ts',
        'src/modules/orders/hooks/b.ts',
        'src/modules/customers/hooks/c.ts',
      ]),
    ],
  ])
  const notices = advise({ records, facts, edges: { importers } })
  assert.equal(notices.length, 1)
  assert.match(notices[0].text, /client\.ts 里有 3 个导出\*\*各归各域\*\*/)
  assert.match(notices[0].text, /fetchCrews→crews/)
})

test('R-118 边界：被两个域共用 / 不足 3 个 / 纯类型导出 / 公开面入口 → 不建议', () => {
  const records = [
    shared('src/shared/api/client.ts', ['a', 'b', 'c']),
    page('src/modules/crews/hooks/a.ts', 'crews'),
    page('src/modules/orders/hooks/b.ts', 'orders'),
  ]
  const importers = new Map([
    [
      'src/shared/api/client.ts',
      new Set(['src/modules/crews/hooks/a.ts', 'src/modules/orders/hooks/b.ts']),
    ],
  ])
  // 四个导出都被同一个域用（那是一个域自己的东西，不是"各归各域"）
  const oneDomain = {
    'src/shared/api/client.ts': fact({
      exports: ['a', 'b', 'c', 'd'].map((name) => ({ name, declared: true, typeOnly: false })),
    }),
    'src/modules/crews/hooks/a.ts': fact({
      imports: ['a', 'b', 'c', 'd'].map((name) => consumer(name)),
    }),
  }
  assert.equal(advise({ records, facts: oneDomain, edges: { importers } }).length, 0)
  // 纯类型导出（DTO 那种"按域命名却该集中"的契约镜像）
  const types = {
    'src/shared/api/client.ts': fact({
      exports: ['a', 'b', 'c'].map((name) => ({ name, declared: true, typeOnly: true })),
    }),
    'src/modules/crews/hooks/a.ts': fact({ imports: [consumer('a')] }),
    'src/modules/orders/hooks/b.ts': fact({ imports: [consumer('b')] }),
  }
  assert.equal(advise({ records, facts: types, edges: { importers } }).length, 0)
})

test('R-118 在真示例上：canonical 给出一条（client.ts 的取数函数），FSD / minimal 零条', async () => {
  const adviceOf = async (name) => {
    const result = await runGuard({
      cwd: fileURLToPath(new URL(`../examples/${name}`, import.meta.url)),
      rules: coreRules,
      quiet: true,
    })
    return result.notices.filter((notice) => notice.code === 'architecture-advice')
  }
  // 两套示例都是"已知健康"的样板：取数跟域走（R-119）之后一条建议都不该有
  assert.equal((await adviceOf('full')).length, 0, 'canonical 的取数已跟域走')
  assert.equal((await adviceOf('full-fsd')).length, 0, 'FSD 的取数已按实体下沉')
  assert.equal((await adviceOf('minimal')).length, 0)
})
