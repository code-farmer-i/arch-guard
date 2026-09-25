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

test('流程：标「已完成 · 本体」的需求，期望里不许再写着"交给生态 / 本体不做"', () => {
  // 这类漂移真实发生过：0.4.0 从 eslint / stylelint 收回了一批规则，DESIGN 的委派表划了线，
  // 但需求的「期望」还写着"交给 eslint；本体不做" —— 状态与期望自相矛盾（R-14 / R-15 / R-32 / R-34 / R-35 / R-36）。
  const lines = read('REQUIREMENTS.md').split('\n')
  const heading = /^\*\*(R-\d+) (.*?)\*\* · ([^·]+) · (.*)$/
  const problems = []
  let checked = 0

  for (let index = 0; index < lines.length; index += 1) {
    const match = heading.exec(lines[index])
    if (!match) continue
    const [, id, title, status, owner] = match
    if (status.trim() !== '已完成' || !owner.trim().startsWith('本体')) continue
    checked += 1
    if (/待做|待事实模型/.test(title)) {
      problems.push(`${id}: 状态是"已完成 · 本体"，标题里还留着"${title.match(/待[^）)]*/)?.[0]}"`)
    }
    let body = ''
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      if (heading.test(lines[cursor])) break
      body += `${lines[cursor]}\n`
    }
    const expected = /^-\s*\*\*期望\*\*[:：](.*)$/m.exec(body)?.[1] ?? ''
    if (/交给/.test(expected)) problems.push(`${id}: 期望写着"交给…"，但状态是"已完成 · 本体"`)
    if (/本体不做/.test(expected))
      problems.push(`${id}: 期望写着"本体不做"，但状态是"已完成 · 本体"`)
  }

  assert.ok(checked > 30, `只解析到 ${checked} 条「已完成 · 本体」，需求格式变了？`)
  assert.deepEqual(problems, [])
})

test('流程：DESIGN §5 的「已实现并带夹具的 N 条」清单必须与注册表逐条一致', () => {
  // 数量对得上、清单却少了一整批：0.4.0 收回的 C / D / H 规则与 S43 / S44 / D24 都没进这份枚举，
  // 而门禁只看条数 —— 于是"设计已落盘"是假象。改这里要连着改 DESIGN 的枚举（或反过来）。
  const design = read('docs/DESIGN.md')
  const section = design.slice(design.indexOf('## 5. 规则清单'), design.indexOf('### 5.1'))
  const block = section
    .split('\n')
    .filter((line) => /^>\s*`[SDCPHM]\d{2}/.test(line)) // 只取"以 id 打头"的枚举行，别把下面的散文一起解析
    .join('\n')

  const listed = new Set()
  for (const match of block.matchAll(/([SDCPHM])(\d{2})(b?)(?:[–-]([SDCPHM])?(\d{2})(b?))?/g)) {
    const [, letter, from, fromSuffix, toLetter, to, toSuffix] = match
    assert.ok(!toLetter || toLetter === letter, `规则区间跨了域：${letter}${from}–${toLetter}${to}`)
    const last = to ? Number(to) : Number(from)
    for (let n = Number(from); n <= last; n += 1) {
      listed.add(`${letter}${String(n).padStart(2, '0')}${to ? toSuffix : fromSuffix}`)
    }
  }

  const actual = coreRules.map((rule) => rule.id).sort()
  assert.ok(listed.size > 90, `只解析到 ${listed.size} 条，DESIGN 的清单格式变了？`)
  assert.deepEqual(
    [...listed].sort(),
    actual,
    'DESIGN §5 的「已实现并带夹具」清单与 coreRules 对不上：多了未实现的、或少了已实现的',
  )
})

test('流程：DESIGN 写成单一等级的规则，判定等级必须与注册表一致', () => {
  // `--min-level L1` 是"只跑路径级规则"的快速档；等级写错 = 宿主以为只跑了路径检查，
  // 实际代码却跑了一堆 AST 规则（H08 / D01 / D02 / D09 / D12–D14 / D18 都写错过）。
  const docLevels = new Map()
  for (const line of read('docs/DESIGN.md').split('\n')) {
    if (!line.startsWith('|')) continue
    const cells = line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim())
    if (cells.length < 4 || !/^[SDCPHM]\d{2}b?$/.test(cells[0])) continue
    const level = cells.find((cell) => /^L[1-5]$/.test(cell))
    if (level) docLevels.set(cells[0], level)
  }

  const mismatches = coreRules
    .filter((rule) => docLevels.has(rule.id) && docLevels.get(rule.id) !== rule.level)
    .map((rule) => `${rule.id}: 代码 ${rule.level} ≠ DESIGN ${docLevels.get(rule.id)}`)
  assert.ok(docLevels.size >= 80, `只解析到 ${docLevels.size} 行等级，DESIGN 的表格格式变了？`)
  assert.deepEqual(mismatches, [])
})

function requirementIdsFrom(text, status) {
  return [...text.matchAll(/^\*\*(R-\d+) [^*]+\*\* · ([^·]+) ·/gm)]
    .filter((match) => match[2].trim() === status)
    .map((match) => match[1])
}
