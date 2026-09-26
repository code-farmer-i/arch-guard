import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, normalize } from 'node:path'
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
  // 枚举从"已实现并带夹具的 N 条"那句开始，到"不在本体跑的"那句为止 ——
  // 后面的散文里也会出现 id（`H01–H05` / `D15`…），它是**委派/未实现**的说明，不能当成本清单
  const lines = section.split('\n')
  const from = lines.findIndex((line) => line.includes('已实现并带夹具的'))
  const to = lines.findIndex((line, index) => index > from && line.includes('不在本体跑的'))
  const block = lines.slice(from, to < 0 ? undefined : to).join('\n')

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

test('流程：用法文档里的包名必须等于 package.json 的 name（CLI 名 ≠ 包名）', () => {
  // 真实踩过：README 与配置示例写着 `from 'arch-guard/presets'` / `pnpm add -D arch-guard`，
  // 而包名是 `@arch-guard/core`（`arch-guard` 只是 bin 名）—— 照着抄的人第一步就解析不到模块。
  // 用法文档是"唯一来源"，它写错等于没有用法文档。
  const pkgName = JSON.parse(read('package.json')).name
  const problems = []
  let checked = 0

  for (const file of ['README.md', 'docs/USAGE.md']) {
    for (const line of read(file).split('\n')) {
      // 安装命令：只看命令本身（`#` 后面是注释，可以提 CLI 名）
      const command = line.split('#')[0]
      if (/(?:pnpm add|npm i|npm install|yarn add)/.test(command)) {
        for (const token of command.match(/@?arch-guard[\w/.-]*/g) ?? []) {
          checked += 1
          if (token !== pkgName) problems.push(`${file}: 安装命令里的包名 '${token}' ≠ ${pkgName}`)
        }
      }
      // import 语句：裸 `arch-guard/...` 解析不到（只查真 import，放行文档里"这是错的"这类引用）
      for (const match of line.matchAll(/import[^\n]*from\s+'([^']+)'/g)) {
        if (!match[1].startsWith('arch-guard')) continue
        checked += 1
        problems.push(`${file}: import '${match[1]}' ≠ ${pkgName}/…`)
      }
      if (line.includes(`from '${pkgName}`)) checked += 1
    }
  }

  assert.ok(checked >= 4, `只校验了 ${checked} 处包名引用，用法文档的示例形态变了？`)
  assert.deepEqual(problems, [])
})

test('流程：README 与 USAGE 里的相对链接必须真的能打开（文档地图不许指空气）', () => {
  // 真实踩过：文档地图指向 `docs/templates/ARCHITECTURE.md`，而磁盘上的文件叫 `ARCHITECTURE.md.template`。
  // 用法文档是"唯一来源"，链接断了就等于把人引到墙上；围栏代码块里的示例链接不算。
  const problems = []
  let checked = 0

  for (const file of ['README.md', 'docs/USAGE.md']) {
    let fence = null
    for (const [index, line] of read(file).split('\n').entries()) {
      const marker = /^\s*(```+|~~~+)/.exec(line)
      if (marker) {
        fence = fence === null ? marker[1][0] : fence === marker[1][0] ? null : fence
        continue
      }
      if (fence !== null) continue
      for (const match of line.matchAll(/\]\((\.\.?\/[^)#\s]*)(?:#[^)]*)?\)/g)) {
        checked += 1
        if (!existsSync(normalize(join(ROOT, dirname(file), match[1])))) {
          problems.push(`${file}:${index + 1} 链接打不开：${match[1]}`)
        }
      }
    }
  }

  assert.ok(checked >= 10, `只校验了 ${checked} 个相对链接，解析逻辑变了？`)
  assert.deepEqual(problems, [])
})

test('流程：需求状态小结的数字必须等于实际条目数（手抄的数字也要有门禁）', () => {
  // 真实漂移过：小结写着「已完成 61」而实际已到 70 —— 与 DESIGN 的规则数同一类病，
  // 只是这次漏在 REQUIREMENTS 身上。状态小结是"还剩什么没做"的入口，它错就等于账本错。
  const text = read('REQUIREMENTS.md')
  const statuses = [...text.matchAll(/^\*\*R-\d+ [^*]+\*\* · ([^·]+) ·/gm)].map((m) => m[1].trim())
  const actual = {
    已完成: statuses.filter((status) => status === '已完成').length,
    进行中: statuses.filter((status) => status === '进行中').length,
    已委派: statuses.filter((status) => status === '已委派').length,
    不做: statuses.filter((status) => status.startsWith('不做')).length,
  }
  const note = /已完成`?\s*(\d+)\s*·\s*`?已委派`?\s*(\d+)\s*·\s*`?不做`?\s*(\d+)/.exec(text)
  const inProgress = /进行中`?\s*(\d+)/.exec(text)
  assert.ok(note, '需求状态小结（摘要那句"已完成 N · 已委派 M · 不做 K"）没找到 —— 格式变了？')
  assert.ok(inProgress, '需求状态小结缺"进行中 N" —— 这一批是跨轮次的长活，必须能表达"还没做完"')
  assert.ok(statuses.length > 70, `只解析到 ${statuses.length} 条需求，条目格式变了？`)
  assert.deepEqual(
    [Number(note[1]), Number(note[2]), Number(note[3]), Number(inProgress[1])],
    [actual.已完成, actual.已委派, actual.不做, actual.进行中],
    '需求状态小结与实际条目数不一致（改状态别忘了改小结）',
  )
  assert.equal(actual.已完成 + actual.进行中 + actual.已委派 + actual.不做, statuses.length)
})

function requirementIdsFrom(text, status) {
  return [...text.matchAll(/^\*\*(R-\d+) [^*]+\*\* · ([^·]+) ·/gm)]
    .filter((match) => match[2].trim() === status)
    .map((match) => match[1])
}

/**
 * **示例的度量必须与实测一致**（2026-09-25 补）：`examples/full` 的 `93/98` 在加了 7 条规则以后
 * 还能在 `AGENTS.md` / `docs/USAGE.md` 里躺着 —— 因为 DESIGN / README / ARCHITECTURE 的计数都有门禁，
 * **示例这一项漏了**。同理还有示例配置头里的「N 个域 / N 个角色 / N 个生效适配器」与「抄 N 行」。
 *
 * 规则：文档里凡提到某个示例的那一行，出现的每个 `N/M` 都必须是**当前的**比率（分子是某个示例的实测值、
 * 分母是规则总数）—— 抄旧数字、把两个示例的数字写反，都会被抓住。
 */
test('流程：示例的度量（跑几条 / 共几条 · 域数 · 角色数 · 适配器数）与实测一致', async () => {
  const { canonical, createRegistry, loadConfig } = await import('../es/index.js')
  const total = coreRules.length
  const measured = new Map()
  const configs = new Map()
  for (const name of ['minimal', 'full', 'full-fsd']) {
    const { config } = await loadConfig({ root: join(ROOT, 'examples', name) })
    configs.set(name, config)
    measured.set(name, createRegistry(coreRules, config).enabled.length)
  }

  for (const doc of ['AGENTS.md', 'docs/USAGE.md']) {
    for (const [index, line] of read(doc).split('\n').entries()) {
      const mentioned = [...measured.keys()].filter((name) =>
        new RegExp(`(?:examples/)?${name}(?![\\w-])`).test(line),
      )
      if (mentioned.length === 0) continue
      // 只在"这一行本来就在讲度量"时要求齐全：提到示例但没给数字的行（如"抄 166 行"）不算
      if (!/\d+\/\d+/.test(line)) continue
      const where = `${doc}:${index + 1}`
      for (const ratio of line.matchAll(/(\d+)\/(\d+)/g)) {
        assert.equal(
          Number(ratio[2]),
          total,
          `${where} 的比率 ${ratio[0]} 分母不是当前规则总数 —— 示例度量过期了`,
        )
        assert.ok(
          [...measured.values()].includes(Number(ratio[1])),
          `${where} 的比率 ${ratio[0]} 与任何示例的实测值都对不上`,
        )
      }
      for (const name of mentioned) {
        assert.ok(
          line.includes(`${measured.get(name)}/${total}`),
          `${where} 提到 ${name}，但没写它当前的 ${measured.get(name)}/${total}`,
        )
      }
    }
  }

  // 示例配置头里的数字同样要可判定（它们是"照抄时最先看到的一句话"）
  const header = read('examples/full/arch.config.mjs')
  const domains = readdirSync(join(ROOT, 'examples/full/src/modules'), {
    withFileTypes: true,
  }).filter((entry) => entry.isDirectory()).length
  assert.equal(
    Number(/(\d+) 个域/.exec(header)?.[1]),
    domains,
    '示例头里的域数与 src/modules 实际目录数不一致',
  )
  assert.equal(
    Number(/(\d+) 个角色/.exec(header)?.[1]),
    canonical().roles.length,
    '示例头里的角色数与 canonical() 实际角色数不一致',
  )
  assert.equal(
    Number(/(\d+) 个生效适配器/.exec(header)?.[1]),
    Object.keys(configs.get('full').adapters).length,
    '示例头里的生效适配器数与实际不一致',
  )
  // 行数与 `wc -l` 对齐（末尾换行不算一行）
  const configText = readFileSync(join(ROOT, 'examples/full/arch.config.mjs'), 'utf8')
  const lines = configText.split('\n').length - (configText.endsWith('\n') ? 1 : 0)
  assert.ok(
    read('docs/USAGE.md').includes(`抄 ${lines} 行`),
    `USAGE 里"抄 N 行"与实际配置行数（${lines}）不一致`,
  )
})

/**
 * **示例配置里提到的落点路径必须存在**（2026-09-25 补）：`examples/full-fsd` 的配置头一度还写着
 * "缓存键进 `src/shared/api/queryKeys.ts`"，而那个文件在 R-97 就搬去 `entities/<实体>/model/query.ts` 了 ——
 * 照抄的人会照着一段不存在的路径去建目录。与"示例度量"同一类：散文没门禁就会烂。
 *
 * 只查**字面**路径（含通配 / 占位符的跳过：它们指的是约定，不是某个文件）。
 */
test('流程：示例配置里提到的落点路径必须存在', () => {
  for (const name of ['minimal', 'full', 'full-fsd']) {
    const text = read(`examples/${name}/arch.config.mjs`)
    const literals = [...text.matchAll(/[`'"](src\/[^`'"]+)[`'"]/g)]
      .map((match) => match[1])
      .filter((token) => !/[*<>{}$]/.test(token))
    for (const token of new Set(literals)) {
      assert.ok(
        existsSync(join(ROOT, 'examples', name, token)),
        `${name}/arch.config.mjs 提到的 ${token} 不存在 —— 照抄的人会照着建一个错的目录`,
      )
    }
  }
})

test('冻结：这些「同一事实」全仓只许有一处定义（曾经各有多份）', () => {
  const walk = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory()
        ? walk(join(dir, entry.name))
        : entry.name.endsWith('.ts')
          ? [join(dir, entry.name)]
          : [],
    )
  const files = walk(join(ROOT, 'src'))
  const singles = [
    {
      label: 'finding() 构造器',
      needle: /^(export )?const finding = \(/m,
      home: 'src/packs/core/rules/finding.ts',
    },
    {
      label: 'lineOf（TS 位置 → 行）',
      needle: /^(export )?const lineOf = /m,
      home: 'src/engine/facts-syntax.ts',
    },
    {
      label: 'positionOf（TS 位置 → 行 + 列）',
      needle: /^(export )?const positionOf = /m,
      home: 'src/engine/facts-syntax.ts',
    },
    {
      label: 'packageNameOf（从 specifier 取包名）',
      needle: /^(export )?function packageNameOf\(/m,
      home: 'src/engine/graph.ts',
    },
    {
      label: 'maskTs（按注释区间遮罩）',
      needle: /^(export )?(async )?function maskTs\(/m,
      home: 'src/packs/core/rules/mask.ts',
    },
    {
      label: 'isTestPath（什么算测试文件）',
      needle: /^(export )?const isTestPath = /m,
      home: 'src/engine/test-paths.ts',
    },
  ]
  for (const item of singles) {
    const found = files
      .filter((path) => item.needle.test(readFileSync(path, 'utf8')))
      .map((path) => path.slice(ROOT.length))
    assert.deepEqual(
      found,
      [item.home],
      `${item.label} 只许在 ${item.home} 定义（曾经多份；加字段要改 N 个地方）`,
    )
  }
})
