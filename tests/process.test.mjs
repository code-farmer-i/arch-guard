import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { coreRules } from '../es/index.js'

/**
 * **流程门禁**：让「需求 → 设计 → 落地」这条主线可判定，而不是墙上的口号。
 *
 * 三条：
 * 1. 活跃规格（draft / ready-for-agent / in-progress）必须有 `Status`、`## 场景` 节与需求编号，
 *    且引用的 `R-xx` 真的存在于 REQUIREMENTS.md（管住的活必须有场景与需求锚点；done 的历史规格不查）。
 * 2. 需求编号连续、不重复。
 * 3. 设计文档里的规则数 / 夹具数与实际一致 —— 加了规则不改 DESIGN / README = 设计没落盘。
 */

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')

const ACTIVE = ['draft', 'ready-for-agent', 'in-progress']
const statusOf = (text) => /^Status:\s*([A-Za-z-]+)/m.exec(text)?.[1] ?? ''

const requirementIds = () => {
  const text = read('REQUIREMENTS.md')
  return [...text.matchAll(/^\*\*R-(\d+)\s/gm)].map((match) => Number(match[1]))
}

const specFiles = () => {
  const dir = join(ROOT, '.scratch')
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({ slug: entry.name, path: join(dir, entry.name, 'spec.md') }))
    .filter((entry) => existsSync(entry.path))
}

test('流程：活跃规格必须有 Status / 场景 / 需求编号，且编号在 REQUIREMENTS 里存在', () => {
  const ids = new Set(requirementIds())
  const active = specFiles()
    .map(({ slug, path }) => ({ slug, text: readFileSync(path, 'utf8') }))
    .filter(({ text }) => ACTIVE.includes(statusOf(text)))

  assert.ok(active.length > 0, '.scratch 下应当至少有一份活跃规格（否则这条门禁在空转）')
  const problems = []
  for (const { slug, text } of active) {
    if (!text.includes('## 场景'))
      problems.push(`${slug}: 缺「## 场景」一节（写不出场景的需求先不做）`)
    const refs = [...text.matchAll(/R-(\d+)/g)].map((match) => Number(match[1]))
    if (refs.length === 0) problems.push(`${slug}: 没有引用任何需求编号（R-xx）`)
    for (const ref of new Set(refs)) {
      if (!ids.has(ref)) problems.push(`${slug}: 引用了不存在的需求 R-${ref}`)
    }
  }
  assert.deepEqual(problems, [])
})

test('流程：需求编号连续、不重复；缺的编号必须"已声明撤销"（登记为「原 R-xx」）', () => {
  const ids = requirementIds()
  assert.ok(ids.length > 0)
  assert.equal(new Set(ids).size, ids.length, '需求编号有重复')
  const sorted = [...ids].sort((a, b) => a - b)
  // 编号不复用：撤掉的需求把编号登记在第七节（写成「原 R-xx」），正文里不再出现 ——
  // 所以空号是允许的，但**必须被声明过**；否则就是漏号（复制粘贴掉了一行）
  const retired = new Set(
    [...read('REQUIREMENTS.md').matchAll(/原 R-(\d+)/g)].map((match) => Number(match[1])),
  )
  const expected = Array.from({ length: sorted[sorted.length - 1] }, (_, index) => index + 1)
  const missing = expected.filter((id) => !sorted.includes(id))
  assert.deepEqual(
    missing.filter((id) => !retired.has(id)),
    [],
    '有编号缺失但没登记为「原 R-xx」',
  )
  for (const id of retired) {
    assert.equal(ids.includes(id), false, `R-${id} 已声明撤销，正文里不该再出现`)
  }
})

test('流程：设计文档里的规则数 / 夹具数与实际一致（不同步就是设计没落盘）', () => {
  const total = coreRules.length

  const design = read('docs/DESIGN.md')
  const designCount = Number(/已实现并带夹具的 (\d+) 条/.exec(design)?.[1])
  assert.equal(designCount, total, 'DESIGN 的「已实现并带夹具的 N 条」与实际规则数不一致')

  const readme = read('README.md')
  assert.equal(
    Number(/共 \*\*(\d+) 条规则\*\*/.exec(readme)?.[1]),
    total,
    'README 的「共 N 条规则」与实际不一致',
  )
  const fixtureRatio = /(\d+)\/(\d+) 有夹具/.exec(readme)
  assert.equal(Number(fixtureRatio?.[1]), total)
  assert.equal(Number(fixtureRatio?.[2]), total)

  const architecture = read('docs/ARCHITECTURE.md')
  assert.equal(
    Number(/(\d+) 条规则的实现/.exec(architecture)?.[1]),
    total,
    'ARCHITECTURE 的规则数与实际不一致',
  )
  const fixtures = readdirSync(join(ROOT, '__fixtures__'), { withFileTypes: true }).filter(
    (entry) => entry.isDirectory(),
  ).length
  assert.equal(
    Number(/(\d+) 个夹具项目/.exec(architecture)?.[1]),
    fixtures,
    'ARCHITECTURE 的夹具数与 __fixtures__ 实际目录数不一致',
  )
})

test('流程：DESIGN §4.9 的委派去向与 REQUIREMENTS 的「已委派」条数一致', () => {
  const design = read('docs/DESIGN.md')
  const section = design.slice(design.indexOf('## 4.9 委派去向'), design.indexOf('## 5. 规则清单'))
  const rows = section
    .split('\n')
    .filter(
      (line) => line.startsWith('| ') && !line.includes('---') && !line.includes('已委派的约束'),
    )
    .filter((line) => !/~~.+~~/.test(line)) // 划线 = 已收回本体
    .filter((line) => !/本体 S08|本体 S15|本体 S16|既没实现|已移除/.test(line)) // 这几种本来就不是"委派出去"
  const delegated = requirementIdsFrom(read('REQUIREMENTS.md'), '已委派')
  assert.deepEqual(
    rows.length,
    delegated.length,
    `§4.9 仍委派的 ${rows.length} 行与需求侧 ${delegated.length} 条「已委派」对不上 —— 要么补/删表行，要么改需求状态`,
  )
})

function requirementIdsFrom(text, status) {
  return [...text.matchAll(/^\*\*(R-\d+) [^*]+\*\* · ([^·]+) ·/gm)]
    .filter((match) => match[2].trim() === status)
    .map((match) => match[1])
}
