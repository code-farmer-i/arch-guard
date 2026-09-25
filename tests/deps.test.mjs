import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

import {
  depsPolicyFrom,
  policyConflicts,
  readProjectDeps,
  coreRules,
  runGuard,
} from '../es/index.js'

const PACKAGE_ROOT = fileURLToPath(new URL('..', import.meta.url))

const run = (fixture, options = {}) =>
  runGuard({
    cwd: `${PACKAGE_ROOT}__fixtures__/${fixture}`,
    rules: coreRules,
    quiet: true,
    ...options,
  })

test('依赖策略：deny 与能力首选冲突必须报出来', () => {
  const policy = depsPolicyFrom({ deny: ['dayjs'], capabilities: { datetime: 'dayjs' } })
  const conflicts = policyConflicts(policy)
  assert.equal(conflicts.length, 1)
  assert.match(conflicts[0], /datetime/)
})

test('依赖策略：能力首选必须在 allow 白名单里', () => {
  const conflicts = policyConflicts(
    depsPolicyFrom({ allow: ['zod'], capabilities: { datetime: 'dayjs' } }),
  )
  assert.ok(conflicts.some((item) => item.includes('不在 allow')))
})

test('依赖事实：Node 内置模块不算幽灵依赖', () => {
  const deps = readProjectDeps(`${PACKAGE_ROOT}examples/minimal`, [
    'node:fs',
    'fs',
    'node:test',
    'left-pad',
  ])
  assert.deepEqual(deps.phantom, ['left-pad'])
})

test('平台内置能力不要求在 allow 白名单里（不是依赖）', () => {
  const policy = depsPolicyFrom({
    allow: ['commander'],
    capabilities: { 'deep-clone': 'structuredClone' },
  })
  assert.deepEqual(policyConflicts(policy, ['deep-clone']), [])
  // 不告诉它这是平台能力，就会当成缺失的依赖 → 报冲突
  assert.equal(policyConflicts(policy).length, 1)
})

test('P 域：注释里写的指纹不算（注释遮罩生效）', async () => {
  const result = await run('deps')
  const mentions = result.all.filter((finding) => /deep-clone|structuredClone/.test(finding.text))
  assert.deepEqual(mentions, [])
})

test('P 域：违规夹具报出四条 error 与一条 warn', async () => {
  const result = await run('deps')
  const byRule = new Map()
  for (const finding of result.all) byRule.set(finding.rule, (byRule.get(finding.rule) ?? 0) + 1)
  assert.deepEqual([...byRule.entries()].sort(), [
    ['P01', 1], // left-pad 未登记
    ['P02', 1], // axios 被禁用
    ['P06', 1], // 手搓 process.argv，且没在用登记的 commander
    // 幽灵依赖（P03）与「登记但未使用」（P08）已委派给 knip / depcheck
  ])
})

test('P 域：手搓日期格式化 / 解析被抓，原生原语与用 dayjs 的文件不报', async () => {
  const result = await run('datetime')
  const p06 = result.all.filter((finding) => finding.rule === 'P06')
  // ① 手搓格式化 / 取分量（main.tsx）② 字符串解析（parse.ts：Date.parse + new Date('…')）
  assert.deepEqual(
    p06.map((finding) => finding.file),
    ['src/app/main.tsx', 'src/shared/lib/parse.ts', 'src/shared/lib/week.ts'],
  )
  assert.match(p06[0].text, /另有 5 处/)

  // ③ 弱指纹 + 自研同名 → P07（warn），这是 P07 首次覆盖 datetime（此前该条目没有 softSyntax）
  const p07 = result.all.filter((finding) => finding.rule === 'P07')
  assert.deepEqual(
    p07.map((finding) => finding.file),
    ['src/shared/lib/dates.ts'],
  )
  assert.match(p07[0].text, /自研了 isSameDay/)

  // ④ 边界（fixture 里 now.ts 是专门的边界探针；expect.json 是 exact，多报一条就会红）：
  //    原生原语 `new Date()` / `Date.now()` / `new Date(ms)`，以及 `getTime` / `setTime` 时间戳读写
  //    —— 都**不算**"手搓日期库"（`getTime` 刻意不在族模式里；只有"与 4 位以上数字手算"才报）
  const touched = new Set([...p06, ...p07].map((finding) => finding.file))
  assert.equal(touched.has('src/shared/lib/now.ts'), false, '原语与时间戳读写不该被当成手搓库')
  // ⑤ 正确使用 dayjs 的文件不报（别的规则可能因为它不可达而报 S15，这里只看 P 域）
  assert.equal(touched.has('src/shared/lib/time.ts'), false)
})

test('P 域：命中指纹但确实在用登记方案时不报（本体即正例）', async () => {
  // 本体用 process.argv.slice（命中 cli-args 强指纹），同时真的 import 了 commander → P06 不该报
  const result = await runGuard({ cwd: PACKAGE_ROOT, rules: coreRules, quiet: true })
  const deps = result.all.filter((finding) => finding.rule.startsWith('P'))
  assert.deepEqual(
    deps.map((finding) => `${finding.rule} ${finding.text}`),
    [],
  )
})

test('P 域：只写声明（能力表 / 适配表）不隐式开启 P01（白名单必须显式 allow）', async () => {
  const result = await run('declarations-only')
  // react / antd 都没登记也不报：声明了什么 ≠ 批准了什么；能力表只驱动 P06
  assert.deepEqual(
    result.all.map((finding) => `${finding.rule} ${finding.file}`),
    ['P06 src/app/main.tsx'],
  )
})

test('P 域：适配表声明的包并入 P01 批准名单（不必在 allow 里重抄）', async () => {
  const result = await run('allowlist-adapters')
  // allow 只有 react/react-dom，但 antd 三件套由 uiKit(antdKit()) 的 packages 批准
  assert.deepEqual(result.all, [])
})

/* ---------------- C1 / C2：P03 幽灵依赖 · P08 声明未用 ---------------- */

const rule = (id) => {
  const found = coreRules.find((entry) => entry.id === id)
  assert.ok(found, `规则 ${id} 不存在`)
  return found
}

const depsCtx = ({
  phantom = [],
  unused = [],
  hasManifest = true,
  imports = {},
  unusedDeps = true,
}) => {
  const relations = Object.keys(imports)
  return {
    config: { adapters: {}, params: { unusedDeps } },
    records: relations.map((rel) => ({ rel, kind: 'ts', layer: 3 })),
    facts: new Map(
      relations.map((rel) => [
        rel,
        { comments: [], exports: [], functions: [], imports: imports[rel] },
      ]),
    ),
    deps: {
      hasManifest,
      runtime: [],
      dev: [],
      peer: [],
      declared: new Set(),
      imported: new Set(),
      phantom,
      unused,
    },
    policy: { allow: [], deny: [], capabilities: {}, fingerprints: [] },
    files: relations,
  }
}

test('P03：幽灵依赖报在引用它的那一行；已声明的包 / node: 内置 / 没清单时不报', () => {
  const findings = rule('P03').run(
    depsCtx({
      phantom: ['left-pad'],
      imports: {
        'src/shared/lib/pad.ts': [{ spec: 'left-pad', line: 3, typeOnly: false, dynamic: false }],
        'src/shared/lib/format.ts': [{ spec: 'dayjs', line: 1, typeOnly: false, dynamic: false }],
      },
    }),
  )
  assert.equal(findings.length, 1)
  assert.equal(findings[0].file, 'src/shared/lib/pad.ts')
  assert.equal(findings[0].line, 3)
  assert.deepEqual(rule('P03').run(depsCtx({ phantom: [], imports: {} })), [])
  assert.deepEqual(
    rule('P03').run(
      depsCtx({
        phantom: ['left-pad'],
        hasManifest: false,
        imports: { 'src/a.ts': [{ spec: 'left-pad', line: 1, typeOnly: false, dynamic: false }] },
      }),
    ),
    [],
    '没有 package.json 时不判（整体跳过依赖类规则）',
  )
})

test('P08：声明未用报在 package.json 上且默认 warn；dev/peer 与"在用"的依赖不报', () => {
  const findings = rule('P08').run(depsCtx({ unused: ['lodash'] }))
  assert.equal(findings.length, 1)
  assert.equal(findings[0].file, 'package.json')
  assert.equal(findings[0].global, true)
  assert.deepEqual(rule('P08').run(depsCtx({ unused: [] })), [], 'unused 为空时不报')
  assert.deepEqual(rule('P08').run(depsCtx({ unused: ['lodash'], hasManifest: false })), [])
  assert.deepEqual(
    rule('P08').run(depsCtx({ unused: ['lodash'], unusedDeps: false })),
    [],
    '没声明 unusedDeps 就不判（默认关：react / 副作用型依赖会误报）',
  )
})
